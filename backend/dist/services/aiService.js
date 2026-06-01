"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQuestionPaper = generateQuestionPaper;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
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
async function generateQuestionPaper(input) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
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
function generateMockQuestionPaper(input) {
    const difficulties = ['Easy', 'Moderate', 'Hard'];
    const sections = [];
    const answerKey = [];
    const sectionLabels = ['A', 'B', 'C', 'D'];
    let questionCounter = 1;
    let sectionIdx = 0;
    input.questionTypes.forEach((qt) => {
        const questions = [];
        for (let i = 0; i < qt.count; i++) {
            const qId = `q${questionCounter}`;
            const difficulty = difficulties[Math.floor((i / qt.count) * 3)] || 'Moderate';
            questions.push({
                id: qId,
                text: `[${difficulty}] Sample ${qt.type} question ${i + 1} for ${input.subject} Grade ${input.grade}.`,
                difficulty,
                marks: qt.marks,
                type: qt.type,
                answer: `Sample answer for question ${questionCounter}.`,
            });
            answerKey.push({ questionId: qId, answer: `Sample answer for question ${questionCounter}.` });
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
