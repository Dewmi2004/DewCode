// Added: folderId (nullable ref to Folder) so files can live inside a
// VS-Code-style folder tree instead of only flat per-project lists.

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFile extends Document {
  _id: mongoose.Types.ObjectId;
  fileName: string;
  content: string;
  language: string;
  projectId: mongoose.Types.ObjectId;
  folderId: mongoose.Types.ObjectId | null;
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
  folderId: string | null;
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
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

fileSchema.index({ projectId: 1, createdAt: 1 });
// A file name only needs to be unique within its folder (VS Code rule),
// not across the whole project.
fileSchema.index({ projectId: 1, folderId: 1, fileName: 1 }, { unique: true });

fileSchema.methods.toSafeObject = function (): SafeFile {
  return {
    id: this._id.toString(),
    fileName: this.fileName,
    content: this.content,
    language: this.language,
    projectId: this.projectId.toString(),
    folderId: this.folderId ? this.folderId.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const File: Model<IFile> = mongoose.model<IFile>('File', fileSchema);
export default File;
