"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Assignment_1 = __importDefault(require("../models/Assignment"));
const Result_1 = __importDefault(require("../models/Result"));
const queue_1 = require("../services/queue");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// GET all assignments
router.get('/', async (req, res) => {
    try {
        const assignments = await Assignment_1.default.find().sort({ createdAt: -1 });
        res.json({ success: true, data: assignments });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET single assignment
router.get('/:id', async (req, res) => {
    try {
        const assignment = await Assignment_1.default.findById(req.params.id);
        if (!assignment)
            return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: assignment });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST create assignment and queue generation
router.post('/', async (req, res) => {
    try {
        const { title, subject, grade, dueDate, questionTypes, additionalInstructions, uploadedFileContent, uploadedFile, schoolName, } = req.body;
        // Validate
        if (!title || !subject || !grade || !dueDate || !questionTypes?.length) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        for (const qt of questionTypes) {
            if (!qt.type || qt.count < 1 || qt.marks < 1) {
                return res.status(400).json({ success: false, error: 'Invalid question type data' });
            }
        }
        const totalQuestions = questionTypes.reduce((s, qt) => s + qt.count, 0);
        const totalMarks = questionTypes.reduce((s, qt) => s + qt.count * qt.marks, 0);
        const assignment = new Assignment_1.default({
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
        // Queue the job
        const job = await queue_1.generationQueue.add('generate', { assignmentId: assignment._id.toString() }, { jobId: (0, uuid_1.v4)(), attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
        assignment.jobId = job.id;
        await assignment.save();
        res.status(201).json({
            success: true,
            data: assignment,
            message: 'Assignment created. Generation started.',
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// DELETE assignment
router.delete('/:id', async (req, res) => {
    try {
        const assignment = await Assignment_1.default.findByIdAndDelete(req.params.id);
        if (!assignment)
            return res.status(404).json({ success: false, error: 'Not found' });
        if (assignment.resultId)
            await Result_1.default.findByIdAndDelete(assignment.resultId);
        res.json({ success: true, message: 'Deleted' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET result for assignment
router.get('/:id/result', async (req, res) => {
    try {
        const assignment = await Assignment_1.default.findById(req.params.id);
        if (!assignment)
            return res.status(404).json({ success: false, error: 'Not found' });
        if (assignment.status !== 'completed' || !assignment.resultId) {
            return res.json({ success: true, data: null, status: assignment.status });
        }
        const result = await Result_1.default.findById(assignment.resultId);
        res.json({ success: true, data: result, status: 'completed' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST regenerate
router.post('/:id/regenerate', async (req, res) => {
    try {
        const assignment = await Assignment_1.default.findById(req.params.id);
        if (!assignment)
            return res.status(404).json({ success: false, error: 'Not found' });
        // Delete old result
        if (assignment.resultId) {
            await Result_1.default.findByIdAndDelete(assignment.resultId);
        }
        assignment.status = 'pending';
        assignment.resultId = undefined;
        await assignment.save();
        const job = await queue_1.generationQueue.add('generate', { assignmentId: assignment._id.toString() }, { jobId: (0, uuid_1.v4)(), attempts: 3 });
        assignment.jobId = job.id;
        await assignment.save();
        res.json({ success: true, message: 'Regeneration started' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
