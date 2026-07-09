// Explicit folder entities so empty folders persist (like VS Code) instead
// of being inferred from slash-delimited file names.

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFolder extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  projectId: mongoose.Types.ObjectId;
  parentId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  toSafeObject(): SafeFolder;
}

export interface SafeFolder {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const folderSchema = new Schema<IFolder>(
  {
    name: {
      type: String,
      required: [true, 'Folder name is required'],
      trim: true,
      maxlength: [255, 'Folder name cannot exceed 255 characters'],
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required'],
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

folderSchema.index({ projectId: 1, parentId: 1 });
// Two folders with the same name can't sit in the same parent (VS Code rule)
folderSchema.index({ projectId: 1, parentId: 1, name: 1 }, { unique: true });

folderSchema.methods.toSafeObject = function (): SafeFolder {
  return {
    id: this._id.toString(),
    name: this.name,
    projectId: this.projectId.toString(),
    parentId: this.parentId ? this.parentId.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Folder: Model<IFolder> = mongoose.model<IFolder>('Folder', folderSchema);
export default Folder;
