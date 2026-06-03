import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  owner: mongoose.Types.ObjectId;
  language: string;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt: Date;
  updatedAt: Date;
  toSafeObject(): SafeProject;
}

export interface SafeProject {
  id: string;
  name: string;
  description?: string;
  owner: string;
  language: string;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
    },
    language: {
      type: String,
      default: 'JavaScript',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Archived'],
      default: 'Active',
    },
  },
  { timestamps: true, versionKey: false }
);

projectSchema.index({ owner: 1, createdAt: -1 });

projectSchema.methods.toSafeObject = function (): SafeProject {
  return {
    id: this._id.toString(),
    name: this.name,
    description: this.description,
    owner: this.owner.toString(),
    language: this.language,
    status: this.status,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Project: Model<IProject> = mongoose.model<IProject>('Project', projectSchema);
export default Project;