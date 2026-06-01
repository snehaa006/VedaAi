import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestion {
  id: string;
  text: string;
  difficulty: 'Easy' | 'Moderate' | 'Hard';
  marks: number;
  type: string;
  answer?: string;
}

export interface ISection {
  id: string;
  title: string;
  instruction: string;
  questions: IQuestion[];
  totalMarks: number;
}

export interface IQuestionPaper {
  schoolName: string;
  subject: string;
  grade: string;
  timeAllowed: string;
  maximumMarks: number;
  sections: ISection[];
}

export interface IResult extends Document {
  assignmentId: mongoose.Types.ObjectId;
  questionPaper: IQuestionPaper;
  answerKey: Array<{ questionId: string; answer: string }>;
  createdAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  id: { type: String, required: true },
  text: { type: String, required: true },
  difficulty: { type: String, enum: ['Easy', 'Moderate', 'Hard'], required: true },
  marks: { type: Number, required: true },
  type: { type: String, required: true },
  answer: { type: String },
});

const SectionSchema = new Schema<ISection>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  instruction: { type: String, required: true },
  questions: [QuestionSchema],
  totalMarks: { type: Number, required: true },
});

const ResultSchema = new Schema<IResult>(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
    questionPaper: {
      schoolName: String,
      subject: String,
      grade: String,
      timeAllowed: String,
      maximumMarks: Number,
      sections: [SectionSchema],
    },
    answerKey: [{ questionId: String, answer: String }],
  },
  { timestamps: true }
);

export default mongoose.model<IResult>('Result', ResultSchema);
