import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { projectApi, fileApi, folderApi } from '../../services/projectApi';
import { ApiError } from '../../services/api';

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
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFolder {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Plain object so it survives Redux's serializability check (Error
// instances don't serialize cleanly into rejected-action payloads).
export interface LimitError {
  message: string;
  upgrade: boolean;
}

const toLimitError = (err: unknown, fallback: string): LimitError => {
  if (err instanceof ApiError) return { message: err.message, upgrade: err.upgrade };
  return { message: err instanceof Error ? err.message : fallback, upgrade: false };
};

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  files: ProjectFile[];          // files for the active project
  folders: ProjectFolder[];      // folders for the active project
  activeFile: ProjectFile | null;
  openFiles: ProjectFile[];      // tab-pinned open files
  loading: boolean;
  filesLoading: boolean;
  foldersLoading: boolean;
  error: string | null;
  maxProjects: number | null;    // null = unlimited (Plus plan)
}

// ── Async thunks ─────────────────────────────────────────────────────────

export const fetchProjects = createAsyncThunk('projects/fetchAll', async () => {
  const resp = await projectApi.getAll();
  return {
    projects: resp.data!.projects as Project[],
    maxProjects: (resp.data as { maxProjects?: number | null })?.maxProjects ?? null,
  };
});

export const createProject = createAsyncThunk(
  'projects/create',
  async (payload: { name: string; description?: string; language?: string }, { rejectWithValue }) => {
    try {
      const resp = await projectApi.create(payload);
      return resp.data!.project as Project;
    } catch (err) {
      return rejectWithValue(toLimitError(err, 'Failed to create project.'));
    }
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
  async (
    payload: { fileName: string; content?: string; language?: string; projectId: string; folderId?: string | null },
    { rejectWithValue }
  ) => {
    try {
      const resp = await fileApi.create(payload);
      return resp.data!.file as ProjectFile;
    } catch (err) {
      return rejectWithValue(toLimitError(err, 'Failed to create file.'));
    }
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

// ── Folder thunks ───────────────────────────────────────────────────────

export const fetchFolders = createAsyncThunk(
  'projects/fetchFolders',
  async (projectId: string) => {
    const resp = await folderApi.getByProject(projectId);
    return resp.data!.folders as ProjectFolder[];
  }
);

export const createFolder = createAsyncThunk(
  'projects/createFolder',
  async (
    payload: { name: string; projectId: string; parentId?: string | null },
    { rejectWithValue }
  ) => {
    try {
      const resp = await folderApi.create(payload);
      return resp.data!.folder as ProjectFolder;
    } catch (err) {
      return rejectWithValue(toLimitError(err, 'Failed to create folder.'));
    }
  }
);

export const renameFolder = createAsyncThunk(
  'projects/renameFolder',
  async ({ id, name }: { id: string; name: string }) => {
    const resp = await folderApi.rename(id, name);
    return resp.data!.folder as ProjectFolder;
  }
);

export const deleteFolder = createAsyncThunk(
  'projects/deleteFolder',
  async (id: string, { getState }) => {
    await folderApi.delete(id);
    // Collect every descendant folder id client-side too, so we can purge
    // their files from local state without waiting on a re-fetch.
    const state = getState() as { projects: ProjectState };
    const allFolders = state.projects.folders;
    const removedFolderIds = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of allFolders) {
        if (f.parentId && removedFolderIds.has(f.parentId) && !removedFolderIds.has(f.id)) {
          removedFolderIds.add(f.id);
          grew = true;
        }
      }
    }
    return { removedFolderIds: Array.from(removedFolderIds) };
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────

const projectSlice = createSlice({
  name: 'projects',
  initialState: {
    projects: [],
    activeProject: null,
    files: [],
    folders: [],
    activeFile: null,
    openFiles: [],
    loading: false,
    filesLoading: false,
    foldersLoading: false,
    error: null,
    maxProjects: null,
  } as ProjectState,
  reducers: {
    setActiveProject(state, action: PayloadAction<Project | null>) {
      state.activeProject = action.payload;
      state.files = [];
      state.folders = [];
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
        state.projects = action.payload.projects;
        state.maxProjects = action.payload.maxProjects;
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
        state.error = (action.payload as LimitError | undefined)?.message ?? action.error.message ?? 'Failed to create project.';
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
        state.folders = [];
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
    builder
      .addCase(createFile.fulfilled, (state, action) => {
        state.files.push(action.payload);
        // Auto-open the new file
        state.openFiles.push(action.payload);
        state.activeFile = action.payload;
      })
      .addCase(createFile.rejected, (state, action) => {
        state.error = (action.payload as LimitError | undefined)?.message ?? action.error.message ?? 'Failed to create file.';
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

    // fetchFolders
    builder
      .addCase(fetchFolders.pending, (state) => { state.foldersLoading = true; })
      .addCase(fetchFolders.fulfilled, (state, action) => {
        state.folders = action.payload;
        state.foldersLoading = false;
      })
      .addCase(fetchFolders.rejected, (state, action) => {
        state.foldersLoading = false;
        state.error = action.error.message ?? 'Failed to fetch folders.';
      });

    // createFolder
    builder
      .addCase(createFolder.fulfilled, (state, action) => {
        state.folders.push(action.payload);
      })
      .addCase(createFolder.rejected, (state, action) => {
        state.error = (action.payload as LimitError | undefined)?.message ?? action.error.message ?? 'Failed to create folder.';
      });

    // renameFolder
    builder.addCase(renameFolder.fulfilled, (state, action) => {
      const idx = state.folders.findIndex((f) => f.id === action.payload.id);
      if (idx !== -1) state.folders[idx] = action.payload;
    });

    // deleteFolder — purge the folder, every descendant folder, and any
    // files that lived inside any of them (mirrors the backend cascade).
    builder.addCase(deleteFolder.fulfilled, (state, action) => {
      const removed = new Set(action.payload.removedFolderIds);
      state.folders = state.folders.filter((f) => !removed.has(f.id));
      state.files = state.files.filter((f) => !f.folderId || !removed.has(f.folderId));
      state.openFiles = state.openFiles.filter((f) => state.files.some((sf) => sf.id === f.id));
      if (state.activeFile && !state.files.some((f) => f.id === state.activeFile!.id)) {
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
