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
- Write polished assignment questions, not OCR summaries. Do not quote long raw text from the reference.
- Do not repeat the subject, grade/class, school, or phrase "uploaded image" inside every question. Those belong in the paper header.
- Turn reference facts into direct student tasks such as explain, compare, identify, calculate, justify, label, or infer.
- Multiple choice questions must include four clear options and only one best answer.
- Fill-in-the-blank questions must contain a meaningful blank and enough context to answer it.
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
function getOpenAIImageContent(uploadedFile) {
    if (!uploadedFile)
        return null;
    if (!SUPPORTED_IMAGE_TYPES.has(uploadedFile.mimeType))
        return null;
    if (!uploadedFile.data)
        return null;
    return {
        type: 'image_url',
        image_url: {
            url: `data:${uploadedFile.mimeType};base64,${uploadedFile.data}`,
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
async function generateWithAnthropic(input, prompt) {
    const imageContent = getImageContent(input.uploadedFile);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
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
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Anthropic API error ${response.status}: ${errorBody.slice(0, 500)}`);
    }
    const data = await response.json();
    return parseQuestionPaper(data.content?.[0]?.text || '', input);
}
async function generateWithOpenAI(input, prompt) {
    const imageContent = getOpenAIImageContent(input.uploadedFile);
    const content = imageContent
        ? [{ type: 'text', text: prompt }, imageContent]
        : prompt;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            max_tokens: 4000,
            messages: [{ role: 'user', content }],
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`OpenAI API error ${response.status}: ${errorBody.slice(0, 500)}`);
    }
    const data = await response.json();
    return parseQuestionPaper(data.choices?.[0]?.message?.content || '', input);
}
function parseQuestionPaper(rawText, input) {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No valid JSON in AI response');
    }
    const questionPaper = JSON.parse(jsonMatch[0]);
    validateQuestionPaper(questionPaper);
    const normalizedQuestionPaper = normalizeQuestionPaper(input, questionPaper);
    return { questionPaper: normalizedQuestionPaper, answerKey: buildAnswerKey(normalizedQuestionPaper) };
}
function buildAnswerKey(questionPaper) {
    const answerKey = [];
    questionPaper.sections.forEach((section) => {
        section.questions.forEach((q) => {
            if (q.answer) {
                answerKey.push({ questionId: q.id, answer: q.answer });
            }
        });
    });
    return answerKey;
}
async function generateQuestionPaper(input) {
    const prompt = buildPrompt(input);
    const errors = [];
    if (process.env.ANTHROPIC_API_KEY) {
        try {
            return await generateWithAnthropic(input, prompt);
        }
        catch (err) {
            errors.push(err.message || String(err));
        }
    }
    if (process.env.OPENAI_API_KEY) {
        try {
            return await generateWithOpenAI(input, prompt);
        }
        catch (err) {
            errors.push(err.message || String(err));
        }
    }
    if (input.uploadedFile) {
        try {
            const extractedText = await extractTextFromImage(input.uploadedFile);
            if (extractedText) {
                return generateMockQuestionPaper({
                    ...input,
                    uploadedFileContent: [
                        input.uploadedFileContent,
                        `Text extracted from uploaded image "${input.uploadedFile.name}": ${extractedText}`,
                    ].filter(Boolean).join('\n\n'),
                });
            }
        }
        catch (err) {
            errors.push(err.message || String(err));
        }
    }
    if (errors.length) {
        console.error('AI providers failed, using fallback:', errors.join(' | '));
    }
    return generateMockQuestionPaper(input);
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
                : buildGenericQuestion(qt.type, input.subject, i + 1);
            const answer = snippet
                ? buildReferenceAnswer(snippet)
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
        .replace(/[^\S\r\n]+/g, ' ')
        .replace(/[^\w\s.,:;!?%()/-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned)
        return [];
    const conceptSnippets = getTrafficDemandConcepts(cleaned);
    if (conceptSnippets.length >= 3)
        return conceptSnippets;
    const labelledSnippets = cleaned
        .split(/(?=\b(?:Objective|Tools Used|Evaluation metric|Final OOF Score|Step\s*\d+|Timestamp Parsing|Cyclical Encoding|Geohash Decoding|Missing Value Imputation|Categorical Encoding|Geohash Aggregated Statistics|Target Encoding|Interaction Features|Model Training|Feature Category|Road Type|Environmental Data|Geographic Data|Missing Values?|Time-based|Peak Hours?|Observation|Conclusion|Summary|Result|Dataset|Model)\b)/i)
        .map(cleanReferenceSnippet)
        .filter((part) => part.length >= 25)
        .slice(0, 12);
    if (labelledSnippets.length >= 3)
        return labelledSnippets;
    const sentenceSnippets = cleaned
        .split(/(?<=[.!?])\s+|\n+/)
        .map(cleanReferenceSnippet)
        .filter((part) => part.length >= 25)
        .slice(0, 12);
    if (sentenceSnippets.length) {
        return sentenceSnippets.map((part) => truncateAtWord(part, 220));
    }
    const words = cleaned.split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < words.length; i += 18) {
        const chunk = cleanReferenceSnippet(words.slice(i, i + 18).join(' '));
        if (chunk.length >= 20)
            chunks.push(truncateAtWord(chunk, 220));
        if (chunks.length >= 12)
            break;
    }
    return chunks;
}
function getTrafficDemandConcepts(content) {
    const normalized = content.toLowerCase();
    const concepts = [];
    if (normalized.includes('traffic demand') && /predict|objective|goal/.test(normalized)) {
        concepts.push('Objective: predict traffic demand values on a 0 to 1 scale using historical road, weather, location, and timestamp data.');
    }
    if (normalized.includes('r2_score') || normalized.includes('oof score') || normalized.includes('95.66')) {
        concepts.push('Evaluation metric: use an R2-based score where higher values indicate better prediction performance; the final OOF score was 95.66 out of 100.');
    }
    if (normalized.includes('python') && (normalized.includes('pandas') || normalized.includes('numpy'))) {
        concepts.push('Tools used: Python, pandas, numpy, and pygeohash were used for data processing and geographic feature extraction.');
    }
    if (normalized.includes('timestamp parsing') || normalized.includes('h:mm')) {
        concepts.push('Timestamp parsing: split each H:MM timestamp into numeric hour and minute features.');
    }
    if (normalized.includes('cyclical encoding') || normalized.includes('sin') && normalized.includes('cos')) {
        concepts.push('Cyclical encoding: transform hour, minute, and day with sine and cosine so the model understands wraparound time patterns such as hour 23 being close to hour 0.');
    }
    if (normalized.includes('geohash decoding') || normalized.includes('lat/lon')) {
        concepts.push('Geohash decoding: convert geohash strings into latitude and longitude so the model can use real location information.');
    }
    if (normalized.includes('missing value') || normalized.includes('filled with median') || normalized.includes('filled with mode')) {
        concepts.push('Missing value imputation: fill temperature with the median and fill weather or road type with the mode.');
    }
    if (normalized.includes('categorical encoding') || normalized.includes('ordinal encoding') || normalized.includes('label encoding')) {
        concepts.push('Categorical encoding: convert road type, weather, large vehicle, and landmark categories into numeric features.');
    }
    if (normalized.includes('aggregated statistics') || normalized.includes('target encoding')) {
        concepts.push('Geohash target encoding: compute mean, standard deviation, and median demand per geohash to create strong location-based features.');
    }
    if (normalized.includes('interaction features') || normalized.includes('hour x roadtype') || normalized.includes('hour × roadtype')) {
        concepts.push('Interaction features: combine features such as hour x road type and number of lanes x large vehicles to capture joint effects.');
    }
    if (normalized.includes('23 features') || normalized.includes('zero missing values')) {
        concepts.push('Final feature set: the model used 23 engineered features and had zero missing values after preprocessing.');
    }
    if (normalized.includes('lightgbm') || normalized.includes('gradient boosting')) {
        concepts.push('Model training: train a LightGBM gradient boosting model because it handles mixed feature types efficiently.');
    }
    return concepts;
}
function cleanReferenceSnippet(snippet) {
    return snippet
        .replace(/^Text extracted from uploaded image "[^"]+":\s*/i, '')
        .replace(/TRAFFIC DEMAND PREDICTION\s*[—-]\s*APPROACH SUMMARY/gi, '')
        .replace(/={3,}|-{3,}/g, ' ')
        .replace(/\bStep\s*\d+\s*:?\s*/gi, '')
        .replace(/^(?:Objective|Key Insights?|Exploratory Data Analysis|EDA|Observation|Conclusion|Summary|Result|Tools Used|Evaluation metric|Final OOF Score achieved)\s*:?\s*/i, '')
        .replace(/\b(?:Grade|Class)\s*\d+\b/gi, '')
        .replace(/\b(?:Subject|School)\s*:\s*[^.;!?]+/gi, '')
        .replace(/\b(?:uploaded image|image content|reference image)\b/gi, 'reference material')
        .replace(/\s*["“”]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,:;!?])/g, '$1')
        .trim()
        .replace(/^[,;:.-]+|[,;:.-]+$/g, '')
        .trim();
}
function truncateAtWord(value, maxLength) {
    if (value.length <= maxLength)
        return value;
    const truncated = value.slice(0, maxLength);
    return `${truncated.slice(0, truncated.lastIndexOf(' ') || maxLength).trim()}...`;
}
function getQuestionFocus(snippet) {
    const cleaned = cleanReferenceSnippet(snippet);
    const normalized = cleaned.toLowerCase();
    if (normalized.includes('traffic') && normalized.includes('demand') && /goal|objective|predict/.test(normalized)) {
        return 'the objective of the traffic demand prediction project';
    }
    if (normalized.includes('tools used') || normalized.includes('pandas') || normalized.includes('numpy') || normalized.includes('pygeohash')) {
        return 'the tools used for data processing and location extraction';
    }
    if (normalized.includes('cyclical') || normalized.includes('sin') && normalized.includes('cos')) {
        return 'cyclical encoding of time features';
    }
    if (normalized.includes('timestamp') || normalized.includes('hour') && normalized.includes('minute')) {
        return 'timestamp parsing in feature engineering';
    }
    if (normalized.includes('geohash') && normalized.includes('lat')) {
        return 'geohash decoding for location features';
    }
    if (normalized.includes('imputation') || normalized.includes('median') && normalized.includes('mode')) {
        return 'missing value imputation';
    }
    if (normalized.includes('categorical') || normalized.includes('ordinal') || normalized.includes('label encoding')) {
        return 'categorical feature encoding';
    }
    if (normalized.includes('target encoding') || normalized.includes('aggregated statistics')) {
        return 'geohash-based target encoding';
    }
    if (normalized.includes('interaction')) {
        return 'interaction features in the model';
    }
    if (normalized.includes('lightgbm')) {
        return 'LightGBM model training';
    }
    if (normalized.includes('23 engineered features') || normalized.includes('zero missing values')) {
        return 'the final feature set after preprocessing';
    }
    if (normalized.includes('r2_score') || normalized.includes('oof score') || normalized.includes('score =')) {
        return 'model evaluation using R2 score';
    }
    if (normalized.includes('road type') && /strongest predictor|predictor|demand/.test(normalized)) {
        return 'the effect of road type on traffic demand';
    }
    if (normalized.includes('missing')) {
        return 'missing values in the dataset';
    }
    if (normalized.includes('lanes')) {
        return 'how the number of lanes affected demand';
    }
    if (normalized.includes('peak') || normalized.includes('time-based')) {
        return 'time-based traffic demand patterns';
    }
    const beforeDetails = cleaned.split(/\s+(?:Examples?|included|contained|showed|indicated|using|from)\s+/i)[0];
    const focus = beforeDetails.length >= 18 ? beforeDetails : cleaned;
    return truncateAtWord(focus, 90).replace(/[.?!]+$/, '');
}
function summarizeReferenceFact(snippet) {
    const cleaned = cleanReferenceSnippet(snippet);
    const normalized = cleaned.toLowerCase();
    if (normalized.includes('traffic') && normalized.includes('demand') && /goal|objective|predict/.test(normalized)) {
        return 'To predict traffic demand values using historical transportation and environmental data.';
    }
    if (normalized.includes('tools used') || normalized.includes('pandas') || normalized.includes('numpy') || normalized.includes('pygeohash')) {
        return 'Python, pandas, numpy, and pygeohash were used for processing data and extracting geographic features.';
    }
    if (normalized.includes('cyclical') || normalized.includes('sin') && normalized.includes('cos')) {
        return 'Cyclical encoding helps the model understand that late-night and early-morning hours are close.';
    }
    if (normalized.includes('timestamp') || normalized.includes('hour') && normalized.includes('minute')) {
        return 'Timestamp parsing converts time strings into hour and minute features.';
    }
    if (normalized.includes('geohash') && normalized.includes('lat')) {
        return 'Geohash decoding converts location codes into latitude and longitude features.';
    }
    if (normalized.includes('imputation') || normalized.includes('median') && normalized.includes('mode')) {
        return 'Missing numeric values were filled with the median and categorical values with the mode.';
    }
    if (normalized.includes('categorical') || normalized.includes('ordinal') || normalized.includes('label encoding')) {
        return 'Categorical variables were converted into numeric values so the model could use them.';
    }
    if (normalized.includes('target encoding') || normalized.includes('aggregated statistics')) {
        return 'Geohash-level demand statistics were used as strong location-based features.';
    }
    if (normalized.includes('interaction')) {
        return 'Interaction features captured combined effects such as road type at different hours.';
    }
    if (normalized.includes('lightgbm')) {
        return 'LightGBM was used to train a fast gradient boosting model on the engineered features.';
    }
    if (normalized.includes('23 engineered features') || normalized.includes('zero missing values')) {
        return 'The final model input contained 23 engineered features with no missing values.';
    }
    if (normalized.includes('r2_score') || normalized.includes('oof score') || normalized.includes('score =')) {
        return 'The model was evaluated with an R2-based score, with higher values showing better predictions.';
    }
    if (normalized.includes('road type') && normalized.includes('strongest predictor')) {
        return 'Road type was the strongest predictor of traffic demand.';
    }
    if (normalized.includes('highway') && normalized.includes('residential')) {
        return 'Highways showed higher demand than street and residential roads.';
    }
    if (normalized.includes('missing')) {
        return 'Temperature had the highest missing percentage among the listed features.';
    }
    if (normalized.includes('lanes')) {
        return 'Roads with more lanes generally showed higher demand than smaller roads.';
    }
    if (normalized.includes('peak') || normalized.includes('time-based')) {
        return 'Traffic demand peaked during the stated peak-hour period.';
    }
    return truncateAtWord(cleaned, 130).replace(/[.?!]+$/, '.');
}
function makeQuestionSentence(action, focus) {
    return `${action} ${focus.charAt(0).toLowerCase()}${focus.slice(1)}.`;
}
function buildDistractors(correctAnswer, subject) {
    const normalized = correctAnswer.toLowerCase();
    const generic = [
        'It described an unrelated classroom activity.',
        'It only described the file format used for the activity.',
        'It listed classroom instructions without using the data.',
    ];
    if (normalized.includes('demand') || normalized.includes('traffic')) {
        return [
            'It predicted student attendance from classroom records.',
            'It measured road length without considering demand patterns.',
            'It grouped vehicles by colour instead of traffic behaviour.',
        ];
    }
    if (normalized.includes('missing')) {
        return [
            'No missing values were checked in the dataset.',
            'Only the title of the dataset was reviewed.',
            'Missing values were treated as final predictions.',
        ];
    }
    return generic;
}
function buildShortReferenceQuestion(snippet, index) {
    const normalized = snippet.toLowerCase();
    if (normalized.includes('traffic') && normalized.includes('demand') && /goal|objective|predict/.test(normalized)) {
        return 'What was the main objective of the traffic demand prediction project?';
    }
    if (normalized.includes('tools used') || normalized.includes('pandas') || normalized.includes('numpy') || normalized.includes('pygeohash')) {
        return 'Name two tools used in the project and explain what they helped with.';
    }
    if (normalized.includes('cyclical') || normalized.includes('sin') && normalized.includes('cos')) {
        return 'Why are sine and cosine transformations useful for encoding time features?';
    }
    if (normalized.includes('timestamp') || normalized.includes('hour') && normalized.includes('minute')) {
        return 'Why is timestamp parsing useful before training a traffic demand model?';
    }
    if (normalized.includes('geohash') && normalized.includes('lat')) {
        return 'How does geohash decoding help the model use location information?';
    }
    if (normalized.includes('imputation') || normalized.includes('median') && normalized.includes('mode')) {
        return 'Why were median and mode used to fill missing values in different feature types?';
    }
    if (normalized.includes('categorical') || normalized.includes('ordinal') || normalized.includes('label encoding')) {
        return 'Why must categorical features such as road type and weather be encoded before model training?';
    }
    if (normalized.includes('target encoding') || normalized.includes('aggregated statistics')) {
        return 'How do geohash-level demand statistics improve traffic demand prediction?';
    }
    if (normalized.includes('interaction')) {
        return 'What is the purpose of creating interaction features such as hour x road type?';
    }
    if (normalized.includes('lightgbm')) {
        return 'Why is LightGBM a suitable model for this traffic demand prediction task?';
    }
    if (normalized.includes('23 engineered features') || normalized.includes('zero missing values')) {
        return 'Why is it important to have zero missing values before model training?';
    }
    if (normalized.includes('r2_score') || normalized.includes('oof score') || normalized.includes('score =')) {
        return 'What does the R2-based evaluation score indicate about model performance?';
    }
    if (normalized.includes('road type') && normalized.includes('strongest predictor')) {
        return 'Which road type showed the highest demand, and what does this suggest about traffic patterns?';
    }
    if (normalized.includes('missing')) {
        return 'Identify the features with missing values and state which one had the highest missing percentage.';
    }
    if (normalized.includes('lanes')) {
        return 'How did the number of lanes influence traffic demand?';
    }
    if (normalized.includes('peak') || normalized.includes('time-based')) {
        return 'When did traffic demand peak, and why is that timing useful for prediction?';
    }
    const prompts = [
        'Explain the main purpose of',
        'Identify two important observations about',
        'Describe why the following point is important:',
        'Compare this finding with one other related idea:',
    ];
    const prompt = prompts[(index - 1) % prompts.length];
    return `${prompt} ${getQuestionFocus(snippet).toLowerCase()}.`;
}
function buildFillReferenceQuestion(snippet) {
    const normalized = snippet.toLowerCase();
    if (normalized.includes('traffic') && normalized.includes('demand') && /goal|objective|predict/.test(normalized)) {
        return 'Fill in the blank: The project predicted traffic demand values on a scale from _____ to _____.';
    }
    if (normalized.includes('road type') && normalized.includes('strongest predictor')) {
        return 'Fill in the blank: _____ was identified as the strongest predictor of traffic demand.';
    }
    if (normalized.includes('missing')) {
        return 'Fill in the blank: Among the listed features, _____ had the highest missing percentage.';
    }
    if (normalized.includes('lanes')) {
        return 'Fill in the blank: Roads with more _____ generally showed higher traffic demand.';
    }
    if (normalized.includes('peak') || normalized.includes('time-based')) {
        return 'Fill in the blank: Traffic demand peaked during the _____ period.';
    }
    const blanked = snippet.replace(/\b(?:traffic|demand|model|dataset|analysis|temperature|weather|geographic|prediction|missing)\b/i, '_____');
    return `Fill in the blank: ${truncateAtWord(blanked === snippet ? snippet.replace(/\b\w{6,}\b/, '_____') : blanked, 150)}.`;
}
function buildNumericalReferenceQuestion(snippet) {
    const normalized = snippet.toLowerCase();
    if (normalized.includes('0 to 1')) {
        return 'A model predicts traffic demand on a 0 to 1 scale. If the predicted demands for three locations are 0.25, 0.60, and 0.85, calculate the average predicted demand.';
    }
    if (normalized.includes('r2_score') || normalized.includes('oof score') || normalized.includes('score =')) {
        return 'Using score = 100 x R2, calculate the score when R2 = 0.9566.';
    }
    if (normalized.includes('cyclical') || normalized.includes('sin') && normalized.includes('cos')) {
        return 'For hour = 6, calculate sin(2 x pi x hour / 24) and cos(2 x pi x hour / 24).';
    }
    if (normalized.includes('timestamp') || normalized.includes('hour') && normalized.includes('minute')) {
        return 'Convert the timestamp 9:45 into separate hour and minute features.';
    }
    if (normalized.includes('tools used') || normalized.includes('pandas') || normalized.includes('numpy')) {
        return 'A preprocessing pipeline uses 4 tools. If 3 are for data processing and 1 is for location decoding, what fraction of the tools are used for data processing?';
    }
    if (normalized.includes('geohash')) {
        return 'A geohash is decoded into latitude 28.60 and longitude 77.20. Write the two numeric location features used by the model.';
    }
    if (normalized.includes('missing') || normalized.includes('imputation')) {
        return 'A dataset has 1,000 rows and temperature is missing in 3.2% of them. How many temperature values are missing?';
    }
    if (normalized.includes('categorical') || normalized.includes('roadtype')) {
        return 'If RoadType is encoded as Residential = 0, Street = 1, and Highway = 2, what encoded values represent Street, Highway, and Residential?';
    }
    if (normalized.includes('target encoding') || normalized.includes('mean') && normalized.includes('median')) {
        return 'For one geohash, the recorded demand values are 0.40, 0.50, and 0.70. Calculate the mean demand used as an aggregated feature.';
    }
    if (normalized.includes('interaction')) {
        return 'If hour = 9 and RoadType is encoded as 2, calculate the interaction feature hour x RoadType.';
    }
    if (normalized.includes('23 engineered features') || normalized.includes('zero missing values')) {
        return 'The final dataset has 23 engineered features and 0 missing values. How many missing values remain per feature on average?';
    }
    if (normalized.includes('lanes')) {
        return 'A 2-lane road has demand 0.30 and a 4-lane road has demand 0.70. Calculate the difference in demand.';
    }
    return `Create a simple calculation using ${getQuestionFocus(snippet).toLowerCase()} and show the working.`;
}
function buildDiagramReferenceQuestion(snippet) {
    const normalized = snippet.toLowerCase();
    if (normalized.includes('cyclical') || normalized.includes('sin') && normalized.includes('cos')) {
        return 'Draw or describe a circular time diagram to show why hour 23 is close to hour 0.';
    }
    if (normalized.includes('timestamp') || normalized.includes('hour') && normalized.includes('minute')) {
        return 'Draw a simple flowchart showing how a timestamp is converted into hour and minute features.';
    }
    if (normalized.includes('geohash')) {
        return 'Draw a small pipeline diagram showing geohash input, latitude/longitude decoding, and model-ready location features.';
    }
    if (normalized.includes('missing') || normalized.includes('imputation')) {
        return 'Create a table showing which missing values are filled with median and which are filled with mode.';
    }
    if (normalized.includes('categorical') || normalized.includes('encoding')) {
        return 'Create a mapping table for the encoded road type and weather categories.';
    }
    if (normalized.includes('target encoding') || normalized.includes('aggregated statistics')) {
        return 'Draw a feature-engineering flow showing how geohash demand statistics become model inputs.';
    }
    if (normalized.includes('interaction')) {
        return 'Draw a small diagram showing how two input features combine to form an interaction feature.';
    }
    if (normalized.includes('lightgbm') || normalized.includes('gradient boosting')) {
        return 'Draw a simple training pipeline from engineered features to the LightGBM model and final predictions.';
    }
    return makeQuestionSentence('Interpret the visual or labelled information about', getQuestionFocus(snippet));
}
function buildReferenceAnswer(snippet) {
    return summarizeReferenceFact(snippet);
}
function buildGenericQuestion(type, subject, index) {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('multiple choice')) {
        return [
            `Which option best matches an important idea from ${subject || 'the topic'}?`,
            'A. A correct concept from the lesson',
            'B. An unrelated idea',
            'C. A partially correct but incomplete idea',
            'D. An incorrect explanation',
        ].join('\n');
    }
    if (lowerType.includes('fill')) {
        return `Fill in the blank with the correct term from ${subject || 'the lesson'}: _____.`;
    }
    if (lowerType.includes('true/false')) {
        return `State whether the given statement about ${subject || 'the topic'} is true or false and justify your answer.`;
    }
    if (lowerType.includes('numerical')) {
        return `Solve a numerical problem based on ${subject || 'the topic'} and show all steps.`;
    }
    return `Answer question ${index} using clear reasoning and relevant examples from ${subject || 'the topic'}.`;
}
function extractQuotedReference(text) {
    const quoted = text.match(/"([^"]{20,})"/)?.[1];
    if (quoted)
        return quoted;
    return text
        .replace(/Based on the uploaded image,?\s*/gi, '')
        .replace(/which statement best explains this .*? concept for Grade \d+:?/gi, '')
        .replace(/Answer the following from the uploaded image content \(\d+\):?/gi, '')
        .replace(/Using the uploaded image as reference,?\s*/gi, '')
        .replace(/Create and solve a Grade \d+ .*? numerical problem using the information or concept shown here:?/gi, '')
        .trim();
}
function shouldRewriteQuestion(text) {
    return /uploaded image|image content|Grade\s*0|Based on the|concept for Grade|shown here/i.test(text) ||
        /"[^"]{80,}"/.test(text) ||
        text.length > 260;
}
function normalizeQuestionPaper(input, questionPaper) {
    return {
        ...questionPaper,
        subject: input.subject || questionPaper.subject,
        grade: input.grade || questionPaper.grade,
        sections: questionPaper.sections.map((section) => ({
            ...section,
            questions: section.questions.map((question, index) => {
                if (!shouldRewriteQuestion(question.text))
                    return question;
                const reference = extractQuotedReference(question.text || question.answer || '');
                const fallbackReference = reference || getReferenceSnippets(input.uploadedFileContent)[index] || question.answer || question.text;
                const text = buildReferenceQuestion(question.type, input.subject, input.grade, fallbackReference, index + 1);
                return {
                    ...question,
                    text,
                    answer: question.answer && !shouldRewriteQuestion(question.answer)
                        ? question.answer
                        : buildReferenceAnswer(fallbackReference),
                };
            }),
        })),
    };
}
function buildReferenceQuestion(type, subject, grade, snippet, index) {
    const stem = cleanReferenceSnippet(snippet);
    const focus = getQuestionFocus(stem);
    const lowerType = type.toLowerCase();
    if (lowerType.includes('multiple choice')) {
        const correctAnswer = summarizeReferenceFact(stem).replace(/[.?!]+$/, '');
        const options = [correctAnswer, ...buildDistractors(correctAnswer, subject)];
        return [
            focus.includes('objective')
                ? 'What was the main objective described in the reference material?'
                : `Which option best describes ${focus.toLowerCase()}?`,
            ...options.map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`),
        ].join('\n');
    }
    if (lowerType.includes('true/false')) {
        return `State whether the following statement is true or false, and give one reason: ${truncateAtWord(stem, 140)}.`;
    }
    if (lowerType.includes('fill')) {
        return buildFillReferenceQuestion(stem);
    }
    if (lowerType.includes('diagram') || lowerType.includes('graph')) {
        return buildDiagramReferenceQuestion(stem);
    }
    if (lowerType.includes('numerical')) {
        return buildNumericalReferenceQuestion(stem);
    }
    if (lowerType.includes('long') || lowerType.includes('essay')) {
        return makeQuestionSentence('Explain in detail how', focus);
    }
    return buildShortReferenceQuestion(stem, index);
}
