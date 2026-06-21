// ✅ NEW FILE: src/routes/team.routes.ts

import { Router } from 'express';
import {
  createTeam, getMyTeams, getTeamById, addMember, removeMember, deleteTeam,
} from '../controllers/team.controller';
import { protect } from '../middleware/auth.middleware';
import { requireWriter } from '../middleware/role.middleware';
import { requirePlus } from '../middleware/planLimiter.middleware';

const router = Router();

router.use(protect);

// READ — any member (owner or added member) can view their teams
router.get('/', getMyTeams);
router.get('/:id', getTeamById);

// WRITE — Admin or Developer (not Viewer) + Plus plan required to create
// a group at all. Managing membership/deletion only requires being that
// team's owner (enforced inside the controller); requireWriter is just the
// app-level "not a read-only Viewer" gate, same as projects/files/folders.
router.post('/', requireWriter, requirePlus, createTeam);
router.post('/:id/members', requireWriter, addMember);
router.delete('/:id/members/:memberId', requireWriter, removeMember);
router.delete('/:id', requireWriter, deleteTeam);

export default router;
