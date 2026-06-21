// ✅ NEW FILE: src/models/Team.ts
// A "Group" any Admin or Developer can create (Plus plan required) and add
// other registered users to.
// Projects can optionally be shared with a Team (see Project.teamId) — every
// team member then gets real-time collaborative access to that project.

import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ITeamMember {
  user: mongoose.Types.ObjectId;
  addedAt: Date;
}

export interface ITeam extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  owner: mongoose.Types.ObjectId;
  members: ITeamMember[];
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      maxlength: [100, 'Team name cannot exceed 100 characters'],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, versionKey: false }
);

teamSchema.index({ owner: 1 });
teamSchema.index({ 'members.user': 1 });

// Helper used throughout the codebase: is this user allowed inside the team
// (as owner or member)? Kept as a static so controllers/sockets share one
// definition of "team access" instead of re-deriving it ad hoc.
teamSchema.statics.isMember = function (team: ITeam, userId: string): boolean {
  if (team.owner.toString() === userId) return true;
  return team.members.some((m) => m.user.toString() === userId);
};

const Team: Model<ITeam> = mongoose.model<ITeam>('Team', teamSchema);
export default Team;