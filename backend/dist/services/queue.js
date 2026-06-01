"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generationQueue = void 0;
exports.processAssignmentGeneration = processAssignmentGeneration;
exports.startWorker = startWorker;
const bullmq_1 = require("bullmq");
const aiService_1 = require("./aiService");
const Assignment_1 = __importDefault(require("../models/Assignment"));
const Result_1 = __importDefault(require("../models/Result"));
const websocket_1 = require("./websocket");
function getRedisConnection() {
    if (!process.env.REDIS_URL) {
        return {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
        };
    }
    const redisUrl = new URL(process.env.REDIS_URL);
    return {
        host: redisUrl.hostname,
        port: parseInt(redisUrl.port || '6379', 10),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
    };
}
const connection = getRedisConnection();
exports.generationQueue = new bullmq_1.Queue('question-generation', { connection });
async function processAssignmentGeneration(assignmentId) {
    const assignment = await Assignment_1.default.findById(assignmentId);
    if (!assignment)
        throw new Error('Assignment not found');
    assignment.status = 'processing';
    await assignment.save();
    (0, websocket_1.notifyAssignmentUpdate)(assignmentId, {
        status: 'processing',
        message: 'Generating your question paper...',
        progress: 20,
    });
    const { questionPaper, answerKey } = await (0, aiService_1.generateQuestionPaper)({
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
    (0, websocket_1.notifyAssignmentUpdate)(assignmentId, {
        status: 'processing',
        message: 'Structuring question paper...',
        progress: 80,
    });
    const result = new Result_1.default({ assignmentId, questionPaper, answerKey });
    await result.save();
    assignment.status = 'completed';
    assignment.resultId = result._id;
    await assignment.save();
    (0, websocket_1.notifyAssignmentUpdate)(assignmentId, {
        status: 'completed',
        message: 'Question paper ready!',
        progress: 100,
        resultId: result._id,
    });
    return { resultId: result._id };
}
function startWorker() {
    const worker = new bullmq_1.Worker('question-generation', async (job) => {
        const { assignmentId } = job.data;
        await job.updateProgress(20);
        const result = await processAssignmentGeneration(assignmentId);
        await job.updateProgress(80);
        await job.updateProgress(100);
        return result;
    }, { connection });
    worker.on('failed', async (job, err) => {
        if (job) {
            const { assignmentId } = job.data;
            await Assignment_1.default.findByIdAndUpdate(assignmentId, { status: 'failed' });
            (0, websocket_1.notifyAssignmentUpdate)(assignmentId, {
                status: 'failed',
                message: err.message,
            });
        }
    });
    console.log('BullMQ worker started');
    return worker;
}
