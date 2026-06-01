"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQuestionPaper = generateQuestionPaper;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function buildPrompt(input) {
    const questionBreakdown = input.questionTypes
        .map((qt) => `- ${qt.count} ${qt.type} questions, each worth ${qt.marks} mark(s)`)
        .join('\n');
    return `You are an expert teacher creating a formal question paper. Generate a structured question paper with the following specifications:

Subject: ${input.subject}
Grade/Class: ${input.grade}
School: ${input.schoolName}
Total Questions: ${input.totalQuestions}
Total Marks: ${input.totalMarks}
Time: ${Math.round((input.totalQuestions * 2))} minutes

Question Breakdown:
${questionBreakdown}

${input.additionalInstructions ? `Additional Instructions: ${input.additionalInstructions}` : ''}
${input.uploadedFileContent ? `Reference Material:\n${input.uploadedFileContent.slice(0, 2000)}` : ''}
${input.uploadedFile ? `Reference Image: An uploaded image named "${input.uploadedFile.name}" is attached. Read any visible text, diagrams, tables, formulas, or examples in it and base the paper on that material.` : ''}

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "schoolName": "${input.schoolName}",
  "subject": "${input.subject}",
  "grade": "${input.grade}",
  "timeAllowed": "${Math.round(input.totalQuestions * 2)} minutes",
  "maximumMarks": ${input.totalMarks},
  "sections": [
    {
      "id": "section-a",
      "title": "Section A",
      "instruction": "Attempt all questions. Each question carries X marks.",
      "totalMarks": <number>,
      "questions": [
        {
          "id": "q1",
          "text": "<question text>",
          "difficulty": "Easy|Moderate|Hard",
          "marks": <number>,
          "type": "<question type>",
          "answer": "<concise answer>"
        }
      ]
    }
  ]
}

Rules:
- Group questions into sections by type (Section A for MCQ/Short, Section B for longer, etc.)
- Assign difficulty: roughly 30% Easy, 40% Moderate, 30% Hard
- Make questions relevant and educational for the subject and grade
- If a reference image is attached, prioritize its visible content over generic syllabus questions
- answers should be concise but complete
- Each section instruction should mention marks per question
`;
}
function getImageContent(uploadedFile) {
    if (!uploadedFile)
        return null;
    if (!SUPPORTED_IMAGE_TYPES.has(uploadedFile.mimeType))
        return null;
    if (!uploadedFile.data)
        return null;
    return {
        type: 'image',
        source: {
            type: 'base64',
            media_type: uploadedFile.mimeType,
            data: uploadedFile.data,
        },
    };
}
async function extractTextFromImage(uploadedFile) {
    if (!SUPPORTED_IMAGE_TYPES.has(uploadedFile.mimeType))
        return '';
    const extByType = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
    };
    const tempDir = await fs_1.promises.mkdtemp(path_1.default.join(os_1.default.tmpdir(), 'vedaai-ocr-'));
    const imagePath = path_1.default.join(tempDir, `upload.${extByType[uploadedFile.mimeType] || 'img'}`);
    try {
        await fs_1.promises.writeFile(imagePath, Buffer.from(uploadedFile.data, 'base64'));
        const { stdout } = await execFileAsync('tesseract', [imagePath, 'stdout', '-l', 'eng'], {
            timeout: 30000,
            maxBuffer: 1024 * 1024,
        });
        return stdout.replace(/\s+/g, ' ').trim();
    }
    catch (err) {
        if (err?.code === 'ENOENT') {
            throw new Error('Local OCR requires tesseract to be installed.');
        }
        throw new Error('Could not read text from the uploaded image. Try a clearer image with printed text.');
    }
    finally {
        await fs_1.promises.rm(tempDir, { recursive: true, force: true });
    }
}
async function generateQuestionPaper(input) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        if (input.uploadedFile) {
            const extractedText = await extractTextFromImage(input.uploadedFile);
            if (!extractedText) {
                throw new Error('No readable text was found in the uploaded image.');
            }
            return generateMockQuestionPaper({
                ...input,
                uploadedFileContent: [
                    input.uploadedFileContent,
                    `Text extracted from uploaded image "${input.uploadedFile.name}": ${extractedText}`,
                ].filter(Boolean).join('\n\n'),
            });
        }
        // Return mock data if no API key
        return generateMockQuestionPaper(input);
    }
    const prompt = buildPrompt(input);
    const imageContent = getImageContent(input.uploadedFile);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
                    role: 'user',
                    content: imageContent
                        ? [{ type: 'text', text: prompt }, imageContent]
                        : prompt,
                }],
        }),
    });
    if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
    }
    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';
    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No valid JSON in AI response');
    }
    const questionPaper = JSON.parse(jsonMatch[0]);
    validateQuestionPaper(questionPaper);
    // Build answer key
    const answerKey = [];
    questionPaper.sections.forEach((section) => {
        section.questions.forEach((q) => {
            if (q.answer) {
                answerKey.push({ questionId: q.id, answer: q.answer });
            }
        });
    });
    return { questionPaper, answerKey };
}
function validateQuestionPaper(questionPaper) {
    if (!questionPaper || !Array.isArray(questionPaper.sections)) {
        throw new Error('AI response did not include question paper sections');
    }
    for (const section of questionPaper.sections) {
        if (!section.id || !section.title || !Array.isArray(section.questions)) {
            throw new Error('AI response included an invalid section');
        }
        for (const question of section.questions) {
            if (!question.id || !question.text || !question.type || typeof question.marks !== 'number') {
                throw new Error('AI response included an invalid question');
            }
            if (!['Easy', 'Moderate', 'Hard'].includes(question.difficulty)) {
                throw new Error('AI response included an invalid difficulty value');
            }
        }
    }
}
function generateMockQuestionPaper(input) {
    const difficulties = ['Easy', 'Moderate', 'Hard'];
    const sections = [];
    const answerKey = [];
    const referenceSnippets = getReferenceSnippets(input.uploadedFileContent);
    const sectionLabels = ['A', 'B', 'C', 'D'];
    let questionCounter = 1;
    let sectionIdx = 0;
    input.questionTypes.forEach((qt) => {
        const questions = [];
        for (let i = 0; i < qt.count; i++) {
            const qId = `q${questionCounter}`;
            const difficulty = difficulties[Math.floor((i / qt.count) * 3)] || 'Moderate';
            const snippet = referenceSnippets[(questionCounter - 1) % referenceSnippets.length];
            const text = snippet
                ? buildReferenceQuestion(qt.type, input.subject, input.grade, snippet, i + 1)
                : `[${difficulty}] Sample ${qt.type} question ${i + 1} for ${input.subject} Grade ${input.grade}.`;
            const answer = snippet
                ? `Expected answer should explain: ${snippet}`
                : `Sample answer for question ${questionCounter}.`;
            questions.push({
                id: qId,
                text,
                difficulty,
                marks: qt.marks,
                type: qt.type,
                answer,
            });
            answerKey.push({ questionId: qId, answer });
            questionCounter++;
        }
        sections.push({
            id: `section-${sectionLabels[sectionIdx]}`.toLowerCase(),
            title: `Section ${sectionLabels[sectionIdx]}`,
            instruction: `Attempt all questions. Each question carries ${qt.marks} mark(s).`,
            questions,
            totalMarks: qt.count * qt.marks,
        });
        sectionIdx++;
    });
    return {
        questionPaper: {
            schoolName: input.schoolName,
            subject: input.subject,
            grade: input.grade,
            timeAllowed: `${Math.round(input.totalQuestions * 2)} minutes`,
            maximumMarks: input.totalMarks,
            sections,
        },
        answerKey,
    };
}
function getReferenceSnippets(content) {
    if (!content)
        return [];
    const cleaned = content
        .replace(/^Text extracted from uploaded image "[^"]+":\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned)
        return [];
    const sentenceSnippets = cleaned
        .split(/(?<=[.!?])\s+|\n+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 25)
        .slice(0, 12);
    if (sentenceSnippets.length) {
        return sentenceSnippets.map((part) => part.slice(0, 220));
    }
    const words = cleaned.split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < words.length; i += 18) {
        const chunk = words.slice(i, i + 18).join(' ');
        if (chunk.length >= 20)
            chunks.push(chunk.slice(0, 220));
        if (chunks.length >= 12)
            break;
    }
    return chunks;
}
function buildReferenceQuestion(type, subject, grade, snippet, index) {
    const stem = snippet.replace(/\s+/g, ' ').trim();
    const lowerType = type.toLowerCase();
    if (lowerType.includes('multiple choice')) {
        return `Based on the uploaded image, which statement best explains this ${subject} concept for Grade ${grade}: "${stem}"?`;
    }
    if (lowerType.includes('true/false')) {
        return `State whether the following idea from the uploaded image is true or false and justify your answer: "${stem}".`;
    }
    if (lowerType.includes('fill')) {
        return `Fill in the blank using the concept shown in the uploaded image: ${stem.replace(/\b\w{5,}\b/, '_____')}`;
    }
    if (lowerType.includes('diagram') || lowerType.includes('graph')) {
        return `Using the uploaded image as reference, explain the labelled concept or visual information related to: "${stem}".`;
    }
    if (lowerType.includes('numerical')) {
        return `Create and solve a Grade ${grade} ${subject} numerical problem using the information or concept shown here: "${stem}".`;
    }
    if (lowerType.includes('long') || lowerType.includes('essay')) {
        return `Explain in detail the concept from the uploaded image: "${stem}".`;
    }
    return `Answer the following from the uploaded image content (${index}): "${stem}".`;
}
