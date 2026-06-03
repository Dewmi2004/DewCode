import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFile extends Document {
  _id: mongoose.Types.ObjectId;
  fileName: string;
  content: string;
  language: string;
  projectId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  toSafeObject(): SafeFile;
}

export interface SafeFile {
  id: string;
  fileName: string;
  content: string;
  language: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<IFile>(
  {
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
      maxlength: [255, 'File name cannot exceed 255 characters'],
    },
    content: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: 'plaintext',
      trim: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required'],
    },
  },
  { timestamps: true, versionKey: false }
);

fileSchema.index({ projectId: 1, createdAt: 1 });
fileSchema.index({ projectId: 1, fileName: 1 }, { unique: true });

fileSchema.methods.toSafeObject = function (): SafeFile {
  return {
    id: this._id.toString(),
    fileName: this.fileName,
    content: this.content,
    language: this.language,
    projectId: this.projectId.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const File: Model<IFile> = mongoose.model<IFile>('File', fileSchema);
export default File;