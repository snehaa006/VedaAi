import { Queue, Worker, Job } from 'bullmq';
import { generateQuestionPaper } from './aiService';
import Assignment from '../models/Assignment';
import Result from '../models/Result';
import { notifyAssignmentUpdate } from './websocket';

const connection = process.env.REDIS_URL
  ? {
      url: process.env.REDIS_URL,
      tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    }
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    };

export const generationQueue = new Queue('question-generation', { connection });

export function startWorker() {
  const worker = new Worker(
    'question-generation',
    async (job: Job) => {
      const { assignmentId } = job.data;

      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) throw new Error('Assignment not found');

      // Update status to processing
      assignment.status = 'processing';
      await assignment.save();

      notifyAssignmentUpdate(assignmentId, {
        status: 'processing',
        message: 'Generating your question paper...',
        progress: 20,
      });

      await job.updateProgress(20);

      // Generate
      const { questionPaper, answerKey } = await generateQuestionPaper({
        subject: assignment.subject,
        grade: assignment.grade,
        questionTypes: assignment.questionTypes,
        totalQuestions: assignment.totalQuestions,
        totalMarks: assignment.totalMarks,
        additionalInstructions: assignment.additionalInstructions,
        uploadedFileContent: assignment.uploadedFileContent,
        uploadedFile: assignment.uploadedFile,
        schoolName: assignment.schoolName,
      });

      await job.updateProgress(80);
      notifyAssignmentUpdate(assignmentId, {
        status: 'processing',
        message: 'Structuring question paper...',
        progress: 80,
      });

      // Save result
      const result = new Result({ assignmentId, questionPaper, answerKey });
      await result.save();

      assignment.status = 'completed';
      assignment.resultId = result._id as any;
      await assignment.save();

      await job.updateProgress(100);
      notifyAssignmentUpdate(assignmentId, {
        status: 'completed',
        message: 'Question paper ready!',
        progress: 100,
        resultId: result._id,
      });

      return { resultId: result._id };
    },
    { connection }
  );

  worker.on('failed', async (job, err) => {
    if (job) {
      const { assignmentId } = job.data;
      await Assignment.findByIdAndUpdate(assignmentId, { status: 'failed' });
      notifyAssignmentUpdate(assignmentId, {
        status: 'failed',
        message: err.message,
      });
    }
  });

  console.log('BullMQ worker started');
  return worker;
}
