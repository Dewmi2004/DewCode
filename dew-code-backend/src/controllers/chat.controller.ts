// Sending a message happens over the socket (chat.socket.ts) — that's the
// whole point of "live" chat. REST only covers what doesn't need to be
// real-time: the contact/team list with unread counts (for first paint and
// the floating button's badge), message history, and marking things read.

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Message from '../models/Message';
import Team from '../models/Team';
import { getIO } from '../sockets/io';
import { personalRoom } from '../sockets/chat.socket';
import { sendSuccess, sendError } from '../utils/response';

type PopulatedUserRef = { _id: mongoose.Types.ObjectId; name: string; email: string; avatar?: string };

// Every distinct teammate across every team you belong to (deduped), each
// team itself, and how many unread messages are waiting in each — this is
// the data the chat panel's left rail and the floating button's badge need.
export const getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const userObjectId = req.user!._id;

    const teams = await Team.find({ $or: [{ owner: userId }, { 'members.user': userId }] })
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .sort({ name: 1 });

    const contactMap = new Map<string, { id: string; name: string; email: string; avatar?: string }>();
    for (const team of teams) {
      const owner = team.owner as unknown as PopulatedUserRef;
      if (owner._id.toString() !== userId) {
        contactMap.set(owner._id.toString(), {
          id: owner._id.toString(), name: owner.name, email: owner.email, avatar: owner.avatar,
        });
      }
      const members = team.members as unknown as { user: PopulatedUserRef }[];
      for (const m of members) {
        if (m.user._id.toString() !== userId) {
          contactMap.set(m.user._id.toString(), {
            id: m.user._id.toString(), name: m.user.name, email: m.user.email, avatar: m.user.avatar,
          });
        }
      }
    }

    const teamIds = teams.map((t) => t._id);

    const [dmUnreadAgg, teamUnreadAgg] = await Promise.all([
      Message.aggregate([
        { $match: { chatType: 'dm', recipient: userObjectId, readBy: { $ne: userObjectId } } },
        { $group: { _id: '$sender', count: { $sum: 1 } } },
      ]),
      Message.aggregate([
        { $match: { chatType: 'team', teamId: { $in: teamIds }, readBy: { $ne: userObjectId } } },
        { $group: { _id: '$teamId', count: { $sum: 1 } } },
      ]),
    ]);

    const dmUnreadMap  = new Map(dmUnreadAgg.map((r) => [r._id.toString(), r.count as number]));
    const teamUnreadMap = new Map(teamUnreadAgg.map((r) => [r._id.toString(), r.count as number]));

    const contacts = Array.from(contactMap.values()).map((c) => ({ ...c, unread: dmUnreadMap.get(c.id) ?? 0 }));
    const teamSummaries = teams.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      unread: teamUnreadMap.get(t._id.toString()) ?? 0,
    }));

    const totalUnread =
      contacts.reduce((sum, c) => sum + c.unread, 0) +
      teamSummaries.reduce((sum, t) => sum + t.unread, 0);

    sendSuccess(res, 'Chat overview fetched.', { contacts, teams: teamSummaries, totalUnread });
  } catch (error) { next(error); }
};

export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { chatType, userId: otherUserId, teamId } = req.query as {
      chatType?: string; userId?: string; teamId?: string;
    };

    let filter: Record<string, unknown>;

    if (chatType === 'dm') {
      if (!otherUserId) { sendError(res, 'userId is required for a direct conversation.', 400); return; }
      filter = {
        chatType: 'dm',
        $or: [
          { sender: userId, recipient: otherUserId },
          { sender: otherUserId, recipient: userId },
        ],
      };
    } else if (chatType === 'team') {
      if (!teamId) { sendError(res, 'teamId is required for a team conversation.', 400); return; }
      const team = await Team.findOne({ _id: teamId, $or: [{ owner: userId }, { 'members.user': userId }] });
      if (!team) { sendError(res, 'Team not found or access denied.', 404); return; }
      filter = { chatType: 'team', teamId };
    } else {
      sendError(res, 'chatType must be "dm" or "team".', 400); return;
    }

    const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(50).populate('sender', 'name avatar');

    const ordered = messages.reverse().map((m) => {
      const sender = m.sender as unknown as { _id: mongoose.Types.ObjectId; name: string; avatar?: string };
      return {
        id: m._id.toString(),
        chatType: m.chatType,
        senderId: sender._id.toString(),
        senderName: sender.name,
        senderAvatar: sender.avatar,
        recipientId: m.recipient?.toString(),
        teamId: m.teamId?.toString(),
        content: m.content,
        createdAt: m.createdAt,
      };
    });

    sendSuccess(res, 'Messages fetched.', { messages: ordered });
  } catch (error) { next(error); }
};

export const markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { chatType, userId: otherUserId, teamId } = req.body as {
      chatType?: string; userId?: string; teamId?: string;
    };

    let filter: Record<string, unknown>;
    if (chatType === 'dm') {
      if (!otherUserId) { sendError(res, 'userId is required.', 400); return; }
      filter = { chatType: 'dm', sender: otherUserId, recipient: userId, readBy: { $ne: userId } };
    } else if (chatType === 'team') {
      if (!teamId) { sendError(res, 'teamId is required.', 400); return; }
      filter = { chatType: 'team', teamId, readBy: { $ne: userId } };
    } else {
      sendError(res, 'chatType must be "dm" or "team".', 400); return;
    }

    await Message.updateMany(filter, { $addToSet: { readBy: userId } });

    // Sync any other open tab/device for this same user so its badge drops too.
    getIO()?.to(personalRoom(userId)).emit('chat:read', { chatType, userId: otherUserId, teamId });

    sendSuccess(res, 'Marked as read.', {});
  } catch (error) { next(error); }
};
