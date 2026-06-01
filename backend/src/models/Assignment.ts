import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestionType {
  type: string;
  count: number;
  marks: number;
}

export interface IUploadedFile {
  name: string;
  mimeType: string;
  data: string;
}

export interface IAssignment extends Document {
  title: string;
  subject: string;
  grade: string;
  dueDate: Date;
  questionTypes: IQuestionType[];
  totalQuestions: number;
  totalMarks: number;
  additionalInstructions?: string;
  uploadedFileContent?: string;
  uploadedFile?: IUploadedFile;
  schoolName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  jobId?: string;
  resultId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionTypeSchema = new Schema<IQuestionType>({
  type: { type: String, required: true },
  count: { type: Number, required: true, min: 1 },
  marks: { type: Number, required: true, min: 1 },
});

const UploadedFileSchema = new Schema<IUploadedFile>(
  {
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    data: { type: String, required: true },
  },
  { _id: false }
);

const AssignmentSchema = new Schema<IAssignment>(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true },
    grade: { type: String, required: true },
    dueDate: { type: Date, required: true },
    questionTypes: [QuestionTypeSchema],
    totalQuestions: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    additionalInstructions: { type: String },
    uploadedFileContent: { type: String },
    uploadedFile: UploadedFileSchema,
    schoolName: { type: String, default: 'Delhi Public School' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    jobId: { type: String },
    resultId: { type: Schema.Types.ObjectId, ref: 'Result' },
  },
  { timestamps: true }
);

export default mongoose.model<IAssignment>('Assignment', AssignmentSchema);
