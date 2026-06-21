// ✅ NEW FILE: src/store/slices/teamSlice.ts

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { teamApi } from '../../services/teamApi';
import { ApiError } from '../../services/api';
import type { Team } from '../../types';

interface LimitError {
  message: string;
  upgrade: boolean;
}

const toLimitError = (err: unknown, fallback: string): LimitError => {
  if (err instanceof ApiError) return { message: err.message, upgrade: err.upgrade };
  return { message: err instanceof Error ? err.message : fallback, upgrade: false };
};

interface TeamState {
  teams: Team[];
  loading: boolean;
  error: string | null;
}

export const fetchTeams = createAsyncThunk('teams/fetchAll', async () => {
  const resp = await teamApi.getMine();
  return resp.data!.teams;
});

export const createTeam = createAsyncThunk(
  'teams/create',
  async (name: string, { rejectWithValue }) => {
    try {
      const resp = await teamApi.create(name);
      return resp.data!.team;
    } catch (err) {
      return rejectWithValue(toLimitError(err, 'Failed to create team.'));
    }
  }
);

export const addTeamMember = createAsyncThunk(
  'teams/addMember',
  async ({ teamId, email }: { teamId: string; email: string }, { rejectWithValue }) => {
    try {
      const resp = await teamApi.addMember(teamId, email);
      return resp.data!.team;
    } catch (err) {
      return rejectWithValue(toLimitError(err, 'Failed to add member.'));
    }
  }
);

export const removeTeamMember = createAsyncThunk(
  'teams/removeMember',
  async ({ teamId, memberId }: { teamId: string; memberId: string }) => {
    const resp = await teamApi.removeMember(teamId, memberId);
    return resp.data!.team;
  }
);

export const deleteTeam = createAsyncThunk('teams/delete', async (teamId: string) => {
  await teamApi.delete(teamId);
  return teamId;
});

const teamSlice = createSlice({
  name: 'teams',
  initialState: { teams: [], loading: false, error: null } as TeamState,
  reducers: {
    clearTeamError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeams.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchTeams.fulfilled, (state, action) => { state.teams = action.payload; state.loading = false; })
      .addCase(fetchTeams.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch teams.';
      });

    builder
      .addCase(createTeam.fulfilled, (state, action) => { state.teams.unshift(action.payload); })
      .addCase(createTeam.rejected, (state, action) => {
        state.error = (action.payload as LimitError | undefined)?.message ?? action.error.message ?? 'Failed to create team.';
      });

    builder
      .addCase(addTeamMember.fulfilled, (state, action: PayloadAction<Team>) => {
        const idx = state.teams.findIndex((t) => t.id === action.payload.id);
        if (idx !== -1) state.teams[idx] = action.payload;
      })
      .addCase(addTeamMember.rejected, (state, action) => {
        state.error = (action.payload as LimitError | undefined)?.message ?? action.error.message ?? 'Failed to add member.';
      });

    builder.addCase(removeTeamMember.fulfilled, (state, action: PayloadAction<Team>) => {
      const idx = state.teams.findIndex((t) => t.id === action.payload.id);
      if (idx !== -1) state.teams[idx] = action.payload;
    });

    builder.addCase(deleteTeam.fulfilled, (state, action) => {
      state.teams = state.teams.filter((t) => t.id !== action.payload);
    });
  },
});

export const { clearTeamError } = teamSlice.actions;
export default teamSlice.reducer;
