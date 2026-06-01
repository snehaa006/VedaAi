export interface QuestionType {
  type: string;
  count: number;
  marks: number;
}

export interface Assignment {
  _id: string;
  title: string;
  subject: string;
  grade: string;
  dueDate: string;
  questionTypes: QuestionType[];
  totalQuestions: number;
  totalMarks: number;
  additionalInstructions?: string;
  schoolName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  jobId?: string;
  resultId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  text: string;
  difficulty: 'Easy' | 'Moderate' | 'Hard';
  marks: number;
  type: string;
  answer?: string;
}

export interface Section {
  id: string;
  title: string;
  instruction: string;
  questions: Question[];
  totalMarks: number;
}

export interface QuestionPaper {
  schoolName: string;
  subject: string;
  grade: string;
  timeAllowed: string;
  maximumMarks: number;
  sections: Section[];
}

export interface Result {
  _id: string;
  assignmentId: string;
  questionPaper: QuestionPaper;
  answerKey: Array<{ questionId: string; answer: string }>;
  createdAt: string;
}

export type WSMessage =
  | { type: 'connected'; clientId: string }
  | { type: 'assignment_update'; assignmentId: string; status: string; message: string; progress?: number; resultId?: string };
