import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { projectApi, fileApi } from '../../services/projectApi';

// ── Types ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner: string;
  language: string;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: string;
  fileName: string;
  content: string;
  language: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  files: ProjectFile[];         // files for the active project
  activeFile: ProjectFile | null;
  openFiles: ProjectFile[];     // tab-pinned open files
  loading: boolean;
  filesLoading: boolean;
  error: string | null;
}

// ── Async thunks ─────────────────────────────────────────────────────────

export const fetchProjects = createAsyncThunk('projects/fetchAll', async () => {
  const resp = await projectApi.getAll();
  return resp.data!.projects as Project[];
});

export const createProject = createAsyncThunk(
  'projects/create',
  async (payload: { name: string; description?: string; language?: string }) => {
    const resp = await projectApi.create(payload);
    return resp.data!.project as Project;
  }
);

export const updateProject = createAsyncThunk(
  'projects/update',
  async ({ id, data }: { id: string; data: Partial<Project> }) => {
    const resp = await projectApi.update(id, data);
    return resp.data!.project as Project;
  }
);

export const deleteProject = createAsyncThunk(
  'projects/delete',
  async (id: string) => {
    await projectApi.delete(id);
    return id;
  }
);

export const fetchFiles = createAsyncThunk(
  'projects/fetchFiles',
  async (projectId: string) => {
    const resp = await fileApi.getByProject(projectId);
    return resp.data!.files as ProjectFile[];
  }
);

export const createFile = createAsyncThunk(
  'projects/createFile',
  async (payload: { fileName: string; content?: string; language?: string; projectId: string }) => {
    const resp = await fileApi.create(payload);
    return resp.data!.file as ProjectFile;
  }
);

export const updateFile = createAsyncThunk(
  'projects/updateFile',
  async ({ id, data }: { id: string; data: Partial<ProjectFile> }) => {
    const resp = await fileApi.update(id, data);
    return resp.data!.file as ProjectFile;
  }
);

export const deleteFile = createAsyncThunk(
  'projects/deleteFile',
  async (id: string) => {
    await fileApi.delete(id);
    return id;
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────

const projectSlice = createSlice({
  name: 'projects',
  initialState: {
    projects: [],
    activeProject: null,
    files: [],
    activeFile: null,
    openFiles: [],
    loading: false,
    filesLoading: false,
    error: null,
  } as ProjectState,
  reducers: {
    setActiveProject(state, action: PayloadAction<Project | null>) {
      state.activeProject = action.payload;
      state.files = [];
      state.activeFile = null;
      state.openFiles = [];
    },
    setActiveFile(state, action: PayloadAction<ProjectFile | null>) {
      state.activeFile = action.payload;
      if (action.payload) {
        const alreadyOpen = state.openFiles.some((f) => f.id === action.payload!.id);
        if (!alreadyOpen) {
          state.openFiles = [...state.openFiles, action.payload];
        }
      }
    },
    closeFile(state, action: PayloadAction<string>) {
      state.openFiles = state.openFiles.filter((f) => f.id !== action.payload);
      if (state.activeFile?.id === action.payload) {
        state.activeFile = state.openFiles[state.openFiles.length - 1] ?? null;
      }
    },
    // Update file content in the local openFiles/files lists (unsaved edits)
    patchFileContent(state, action: PayloadAction<{ id: string; content: string }>) {
      const { id, content } = action.payload;
      const inFiles = state.files.find((f) => f.id === id);
      if (inFiles) inFiles.content = content;
      const inOpen = state.openFiles.find((f) => f.id === id);
      if (inOpen) inOpen.content = content;
      if (state.activeFile?.id === id) state.activeFile.content = content;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchProjects
    builder
      .addCase(fetchProjects.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.projects = action.payload;
        state.loading = false;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch projects.';
      });

    // createProject
    builder
      .addCase(createProject.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(createProject.fulfilled, (state, action) => {
        state.projects.unshift(action.payload);
        state.loading = false;
      })
      .addCase(createProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to create project.';
      });

    // updateProject
    builder.addCase(updateProject.fulfilled, (state, action) => {
      const idx = state.projects.findIndex((p) => p.id === action.payload.id);
      if (idx !== -1) state.projects[idx] = action.payload;
      if (state.activeProject?.id === action.payload.id) state.activeProject = action.payload;
    });

    // deleteProject
    builder.addCase(deleteProject.fulfilled, (state, action) => {
      state.projects = state.projects.filter((p) => p.id !== action.payload);
      if (state.activeProject?.id === action.payload) {
        state.activeProject = null;
        state.files = [];
        state.activeFile = null;
        state.openFiles = [];
      }
    });

    // fetchFiles
    builder
      .addCase(fetchFiles.pending, (state) => { state.filesLoading = true; })
      .addCase(fetchFiles.fulfilled, (state, action) => {
        state.files = action.payload;
        state.filesLoading = false;
      })
      .addCase(fetchFiles.rejected, (state, action) => {
        state.filesLoading = false;
        state.error = action.error.message ?? 'Failed to fetch files.';
      });

    // createFile
    builder.addCase(createFile.fulfilled, (state, action) => {
      state.files.push(action.payload);
      // Auto-open the new file
      state.openFiles.push(action.payload);
      state.activeFile = action.payload;
    });

    // updateFile
    builder.addCase(updateFile.fulfilled, (state, action) => {
      const idx = state.files.findIndex((f) => f.id === action.payload.id);
      if (idx !== -1) state.files[idx] = action.payload;
      const oi = state.openFiles.findIndex((f) => f.id === action.payload.id);
      if (oi !== -1) state.openFiles[oi] = action.payload;
      if (state.activeFile?.id === action.payload.id) state.activeFile = action.payload;
    });

    // deleteFile
    builder.addCase(deleteFile.fulfilled, (state, action) => {
      state.files = state.files.filter((f) => f.id !== action.payload);
      state.openFiles = state.openFiles.filter((f) => f.id !== action.payload);
      if (state.activeFile?.id === action.payload) {
        state.activeFile = state.openFiles[0] ?? null;
      }
    });
  },
});

export const {
  setActiveProject,
  setActiveFile,
  closeFile,
  patchFileContent,
  clearError,
} = projectSlice.actions;
export default projectSlice.reducer;
