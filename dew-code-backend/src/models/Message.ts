// One document per chat message. `chatType` decides which of
// recipient/teamId is populated. `readBy` includes the sender at creation
// time (you've obviously "read" your own message) so unread counts are a
// single `readBy: { $ne: userId }` filter either way.

import mongoose, { Document, Schema, Model } from 'mongoose';

export type ChatType = 'dm' | 'team';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  chatType: ChatType;
  sender: mongoose.Types.ObjectId;
  recipient?: mongoose.Types.ObjectId; // dm only
  teamId?: mongoose.Types.ObjectId;    // team only
  content: string;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    chatType: { type: String, enum: ['dm', 'team'], required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [4000, 'Message cannot exceed 4000 characters'],
    },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Fetching a DM thread between two specific people, newest-first.
messageSchema.index({ chatType: 1, sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ chatType: 1, recipient: 1, sender: 1, createdAt: -1 });
// Fetching a team's thread, newest-first.
messageSchema.index({ chatType: 1, teamId: 1, createdAt: -1 });

const Message: Model<IMessage> = mongoose.model<IMessage>('Message', messageSchema);
export default Message;
