import { Router, Request, Response } from 'express';
import Assignment from '../models/Assignment';
import Result from '../models/Result';
import { generationQueue, processAssignmentGeneration } from '../services/queue';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const shouldGenerateInline = () =>
  process.env.INLINE_GENERATION === 'true' || process.env.VERCEL === '1';

// GET all assignments
router.get('/', async (req: Request, res: Response) => {
  try {
    const assignments = await Assignment.find().sort({ createdAt: -1 });
    res.json({ success: true, data: assignments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single assignment
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: assignment });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create assignment and queue generation
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      title,
      subject,
      grade,
      dueDate,
      questionTypes,
      additionalInstructions,
      uploadedFileContent,
      uploadedFile,
      schoolName,
    } = req.body;

    // Validate
    if (!title || !subject || !grade || !dueDate || !questionTypes?.length) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    for (const qt of questionTypes) {
      if (!qt.type || qt.count < 1 || qt.marks < 1) {
        return res.status(400).json({ success: false, error: 'Invalid question type data' });
      }
    }

    const totalQuestions = questionTypes.reduce((s: number, qt: any) => s + qt.count, 0);
    const totalMarks = questionTypes.reduce((s: number, qt: any) => s + qt.count * qt.marks, 0);

    const assignment = new Assignment({
      title,
      subject,
      grade,
      dueDate,
      questionTypes,
      totalQuestions,
      totalMarks,
      additionalInstructions,
      uploadedFileContent,
      uploadedFile,
      schoolName: schoolName || 'Delhi Public School',
      status: 'pending',
    });

    await assignment.save();

    if (shouldGenerateInline()) {
      try {
        await processAssignmentGeneration(assignment._id.toString());
      } catch (err: any) {
        assignment.status = 'failed';
        await assignment.save();
        return res.status(500).json({ success: false, error: err.message });
      }
    } else {
      // Queue the job
      const job = await generationQueue.add(
        'generate',
        { assignmentId: assignment._id.toString() },
        { jobId: uuidv4(), attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
      );

      assignment.jobId = job.id;
      await assignment.save();
    }

    const savedAssignment = await Assignment.findById(assignment._id);

    res.status(201).json({
      success: true,
      data: savedAssignment || assignment,
      message: 'Assignment created. Generation started.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE assignment
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, error: 'Not found' });
    if (assignment.resultId) await Result.findByIdAndDelete(assignment.resultId);
    res.json({ success: true, message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET result for assignment
router.get('/:id/result', async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, error: 'Not found' });

    if (assignment.status !== 'completed' || !assignment.resultId) {
      return res.json({ success: true, data: null, status: assignment.status });
    }

    const result = await Result.findById(assignment.resultId);
    res.json({ success: true, data: result, status: 'completed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST regenerate
router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, error: 'Not found' });

    // Delete old result
    if (assignment.resultId) {
      await Result.findByIdAndDelete(assignment.resultId);
    }

    assignment.status = 'pending';
    assignment.resultId = undefined;
    await assignment.save();

    if (shouldGenerateInline()) {
      try {
        await processAssignmentGeneration(assignment._id.toString());
      } catch (err: any) {
        assignment.status = 'failed';
        await assignment.save();
        return res.status(500).json({ success: false, error: err.message });
      }
    } else {
      const job = await generationQueue.add(
        'generate',
        { assignmentId: assignment._id.toString() },
        { jobId: uuidv4(), attempts: 3 }
      );

      assignment.jobId = job.id;
      await assignment.save();
    }

    res.json({ success: true, message: 'Regeneration started' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
