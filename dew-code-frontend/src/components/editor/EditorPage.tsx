// ✅ FIXED EditorPage.tsx
// Key fix: handleRun now sends { fileName, content } to the backend
// instead of building a broken shell command string.
// The backend writes the file to disk and runs it in Docker.
/* eslint-disable no-template-curly-in-string */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchFiles, setActiveFile, closeFile,
  createFile, updateFile, deleteFile, patchFileContent,
  fetchFolders, createFolder, renameFolder, deleteFolder,
  updateProject,
  type ProjectFolder,
} from '../../store/slices/projectSlice';
import { fetchTeams } from '../../store/slices/teamSlice';
import { CodeCorrection, CodeSuggestion } from '../../types';
import Terminal from '../terminal/Terminal';
import AIAssistant from '../ai/AIAssistant';
import CodeCorrections from './CodeCorrections';
import CodeSuggestions from './CodeSuggestions';
import TopBar from '../layout/TopBar';
import apiFetch from '../../services/api';
import { aiApi } from '../../services/aiApi';
import UpgradeModal from '../billing/UpgradeModal';
import ShareProjectModal from '../projects/ShareProjectModal';
import { connectCollabSocket, disconnectCollabSocket, getCollabSocket, waitForCollabSocket } from '../../services/socket';

// ── Real-time collaboration types ──────────────────────────────────────────

interface CollabPresence { userId: string; name: string; color: string; }
interface RemoteCursor extends CollabPresence { position: { lineNumber: number; column: number }; }

// ── Language map ──────────────────────────────────────────────────────────
const LANG_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', json: 'json', md: 'markdown', html: 'html', css: 'css',
  scss: 'scss', rs: 'rust', go: 'go', java: 'java', txt: 'plaintext',
  sh: 'shell', yml: 'yaml', yaml: 'yaml', xml: 'xml', sql: 'sql',
  c: 'c', cpp: 'cpp', rb: 'ruby', php: 'php',
};

const getLang = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'plaintext';
};

const getFileIcon = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    ts: '🔷', tsx: '⚛️', js: '🟡', jsx: '⚛️', json: '📋',
    py: '🐍', java: '☕', go: '🐹', rs: '🦀', html: '🌐',
    css: '🎨', scss: '🎨', md: '📝', sh: '💲', yml: '⚙️', yaml: '⚙️',
    c: '©️', cpp: '➕', sql: '🗄️', rb: '💎', php: '🐘',
  };
  return icons[ext] || '📄';
};

// Files that can be executed
const RUNNABLE_EXTS = new Set([
  'js','mjs','ts','tsx','py','java','c','cpp','cc','go','rs','sh','bash','rb','php',
]);

const canRunFile = (fileName: string): boolean =>
  RUNNABLE_EXTS.has(fileName.split('.').pop()?.toLowerCase() ?? '');

// Monaco theme map
const MONACO_THEMES: Record<string, string> = {
  dark: 'vs-dark', light: 'light', 'hc-black': 'hc-black',
  solarized: 'vs-dark', monokai: 'vs-dark', dracula: 'vs-dark', nord: 'vs-dark',
};

type DirtyMap = Record<string, boolean>;

interface FolderNode {
  id: string; name: string; type: 'folder';
  children: Array<FolderNode | FileLeafNode>; path: string;
}
interface FileLeafNode { id: string; name: string; type: 'file'; path: string; }

// Builds a VS-Code-style nested tree directly from explicit Folder
// documents (parentId chain) + File documents (folderId), instead of
// inferring structure from slash-delimited file names.
const buildTree = (
  folders: ProjectFolder[],
  fileList: Array<{ id: string; fileName: string; folderId: string | null }>
): Array<FolderNode | FileLeafNode> => {
  const folderNodeMap: Record<string, FolderNode> = {};
  folders.forEach((f) => {
    folderNodeMap[f.id] = { id: f.id, name: f.name, type: 'folder', children: [], path: f.id };
  });

  const root: Array<FolderNode | FileLeafNode> = [];

  // Link folders to their parent (or root) — sorted so nesting is stable.
  folders
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((f) => {
      const node = folderNodeMap[f.id];
      if (f.parentId && folderNodeMap[f.parentId]) {
        folderNodeMap[f.parentId].children.push(node);
      } else {
        root.push(node);
      }
    });

  // Drop files into their folder (or root) — sorted alphabetically.
  fileList
    .slice()
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
    .forEach(({ id, fileName, folderId }) => {
      const leaf: FileLeafNode = { id, name: fileName, type: 'file', path: id };
      if (folderId && folderNodeMap[folderId]) {
        folderNodeMap[folderId].children.push(leaf);
      } else {
        root.push(leaf);
      }
    });

  return root;
};

// ── Run output state ───────────────────────────────────────────────────────
interface RunState {
  running:   boolean;        // a request (execute/stdin/kill) is in flight
  stdout:    string;
  stderr:    string;
  exitCode:  number | null;
  fileName:  string;
  sessionId: string | null;  // set while the backend container is still alive
  exited:    boolean;        // true once the process has finished
}

interface ExecuteResponse {
  success: boolean;
  data?: {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    sessionId?: string | null;
    exited?: boolean;
  };
  message?: string;
}

const EditorPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { activeProject, files, folders, openFiles, activeFile, filesLoading } = useAppSelector((s) => s.projects);
  const settings     = useAppSelector((s) => s.settings.settings);
  const user          = useAppSelector((s) => s.auth.user);
  const { teams }      = useAppSelector((s) => s.teams);
  const isProjectOwner = !!activeProject && activeProject.owner === user?.id;
  const [showShare,    setShowShare]    = useState(false);

  // There's only one role now (Developer) — no read-only viewer tier.
  // Keeping the names so the rest of this file doesn't need touching.
  const isViewer = false;
  const canEdit  = true;

  const [showTerminal,   setShowTerminal]   = useState(true);
  const [showAI,         setShowAI]         = useState(true);
  const [newFileName,    setNewFileName]    = useState('');
  const [showNewFile,    setShowNewFile]    = useState(false);
  const [newFolderName,  setNewFolderName]  = useState('');
  const [showNewFolder,  setShowNewFolder]  = useState(false);
  // Folder the next new file/folder should be created inside (null = root)
  const [newItemParentId, setNewItemParentId] = useState<string | null>(null);
  const [renaming,       setRenaming]       = useState<{ id: string; type: 'file' | 'folder' } | null>(null);
  const [renameValue,    setRenameValue]    = useState('');
  const [showUpgrade,    setShowUpgrade]    = useState(false);
  const [upgradeReason,  setUpgradeReason]  = useState('');
  const [dirty,          setDirty]          = useState<DirtyMap>({});
  const [saveStatus,     setSaveStatus]     = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [contextMenu,    setContextMenu]    = useState<{ x: number; y: number; nodeId: string; type: 'file'|'folder' } | null>(null);
  const [aiContext,      setAiContext]       = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showCorrections, setShowCorrections] = useState(false);
  const [corrections,     setCorrections]     = useState<CodeCorrection | null>(null);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [suggestions,    setSuggestions]    = useState<CodeSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [activePanel,    setActivePanel]    = useState<'ai' | 'corrections' | null>('ai');

  // ✅ NEW unified run state
  const [runState, setRunState] = useState<RunState | null>(null);
  const [showRunOutput, setShowRunOutput] = useState(false);
  const [runStdinInput, setRunStdinInput] = useState('');

  // Mirrors the latest sessionId so the unmount-cleanup effect can kill a
  // still-running container without re-subscribing every time it changes.
  const runSessionIdRef = useRef<string | null>(null);
  const runStdinInputRef = useRef<HTMLInputElement>(null);

  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<any>(null);

  // ── Real-time collaboration state ──────────────────────────────────────
  // Available whenever the open project is shared with a team (teamId set).
  // Team creation itself is Plus-gated server-side; individual members
  // don't each need their own Plus plan to take part.
  const [collaborators, setCollaborators] = useState<CollabPresence[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const isCollabEligible = !!activeProject?.teamId;
  const isCollabEligibleRef = useRef(isCollabEligible);
  const activeFileIdRef = useRef<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);
  const currentFileId = activeFile?.id ?? null;
  const currentProjectId = activeProject?.id ?? null;
  const cursorDecorationIdsRef = useRef<string[]>([]);
  const cursorEmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { isCollabEligibleRef.current = isCollabEligible; }, [isCollabEligible]);
  useEffect(() => { activeFileIdRef.current = currentFileId; }, [currentFileId]);
  useEffect(() => { activeProjectIdRef.current = currentProjectId; }, [currentProjectId]);

  // Only the owner can (re)share a project, and only they see the Share
  // button below — load the team list lazily for them, once.
  useEffect(() => {
    if (isProjectOwner) dispatch(fetchTeams());
  }, [isProjectOwner, dispatch]);

  // Connect once per team-shared project; tear down when leaving it.
  useEffect(() => {
    if (!isCollabEligible) return;
    const socket = connectCollabSocket();

    const onPresence = (list: CollabPresence[]) => setCollaborators(list);
    const onUserJoined = (p: CollabPresence) =>
      setCollaborators((prev) => (prev.some((x) => x.userId === p.userId) ? prev : [...prev, p]));
    const onUserLeft = ({ userId }: { userId: string }) => {
      setCollaborators((prev) => prev.filter((p) => p.userId !== userId));
      setRemoteCursors((prev) => { const next = { ...prev }; delete next[userId]; return next; });
    };
    const onCursorUpdate = (data: RemoteCursor) =>
      setRemoteCursors((prev) => ({ ...prev, [data.userId]: data }));
    const onCodeUpdate = ({ content }: { userId: string; content: string }) => {
      if (!activeFileIdRef.current) return;
      const ed = editorRef.current;
      const savedPosition = ed?.getPosition?.();
      const savedScrollTop = ed?.getScrollTop?.();
      dispatch(patchFileContent({ id: activeFileIdRef.current, content }));
      // @monaco-editor/react resets cursor/scroll when `value` changes
      // externally — put the local typist back where they were.
      requestAnimationFrame(() => {
        if (ed && savedPosition) {
          ed.setPosition(savedPosition);
          if (savedScrollTop != null) ed.setScrollTop(savedScrollTop);
        }
      });
    };
    const onCollabError = (message: string) => { console.warn('Collaboration:', message); setCollaborators([]); };
    const onConnect = () => {
      if (activeFileIdRef.current && activeProjectIdRef.current) {
        socket.emit('join-file', { fileId: activeFileIdRef.current, projectId: activeProjectIdRef.current });
      }
    };

    socket.on('presence', onPresence);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('cursor-update', onCursorUpdate);
    socket.on('code-update', onCodeUpdate);
    socket.on('collab-error', onCollabError);
    socket.on('connect', onConnect);

    return () => {
      socket.off('presence', onPresence);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('cursor-update', onCursorUpdate);
      socket.off('code-update', onCodeUpdate);
      socket.off('collab-error', onCollabError);
      socket.off('connect', onConnect);
      disconnectCollabSocket();
      setCollaborators([]);
      setRemoteCursors({});
    };
  }, [isCollabEligible, activeProject?.id, dispatch]);

  // Join/leave the per-file room whenever the open file changes.
  useEffect(() => {
    if (!isCollabEligible || !currentFileId || !currentProjectId) return;
    let cancelled = false;
    setRemoteCursors({});

    waitForCollabSocket().then((socket) => {
      if (!cancelled && socket.connected) {
        socket.emit('join-file', { fileId: currentFileId, projectId: currentProjectId });
      }
    });

    return () => {
      cancelled = true;
      getCollabSocket()?.emit('leave-file');
    };
  }, [isCollabEligible, currentFileId, currentProjectId]);

  // Render remote cursors as colored carets in the editor.
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const decorations = Object.values(remoteCursors).map((c) => ({
      range: new monaco.Range(c.position.lineNumber, c.position.column, c.position.lineNumber, c.position.column),
      options: {
        beforeContentClassName: `remote-cursor-${c.color.replace('#', '')}`,
        hoverMessage: { value: `**${c.name}**` },
      },
    }));
    cursorDecorationIdsRef.current = ed.deltaDecorations(cursorDecorationIdsRef.current, decorations);
  }, [remoteCursors]);

  const remoteCursorColors = Array.from(new Set(Object.values(remoteCursors).map((c) => c.color)));

  useEffect(() => {
    if (currentProjectId) {
      dispatch(fetchFiles(currentProjectId));
      dispatch(fetchFolders(currentProjectId));
    }
  }, [currentProjectId, dispatch]);

  const tree = buildTree(folders, files.map((f) => ({ id: f.id, fileName: f.fileName, folderId: f.folderId })));
  const newItemParentName = newItemParentId ? folders.find((f) => f.id === newItemParentId)?.name : null;

  const handleEditorMount = (editorInstance: any, monaco: Monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    editorInstance.onDidChangeCursorPosition((e: { position: { lineNumber: number; column: number } }) => {
      if (!isCollabEligibleRef.current || !activeFileIdRef.current) return;
      if (cursorEmitTimerRef.current) clearTimeout(cursorEmitTimerRef.current);
      cursorEmitTimerRef.current = setTimeout(() => {
        const socket = getCollabSocket();
        if (socket?.connected && activeFileIdRef.current) {
          socket.emit('cursor-move', {
            fileId: activeFileIdRef.current,
            position: { lineNumber: e.position.lineNumber, column: e.position.column },
          });
        }
      }, 120);
    });

    monaco.languages.registerCompletionItemProvider('typescript', {
      provideCompletionItems: (model: any, position: any) => {
        const word  = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        return { suggestions: [
          { label: 'rfc',       kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'const ${1:ComponentName}: React.FC = () => {\n  return (\n    <div>\n      ${2}\n    </div>\n  );\n};\n\nexport default ${1:ComponentName};', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'React Functional Component', range },
          { label: 'useState',  kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState<${2:type}>(${3:initialValue});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'React useState hook', range },
          { label: 'useEffect', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'useEffect(() => {\n  ${1}\n  return () => {\n    ${2}  };\n}, [${3}]);', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'React useEffect hook', range },
          { label: 'asyncfn',   kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'const ${1:fn} = async (${2}): Promise<${3:void}> => {\n  try {\n    ${4}\n  } catch (error) {\n    console.error(error);\n  }\n};', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Async function with try/catch', range },
        ]};
      },
    });
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model: any, position: any) => {
        const word  = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        return { suggestions: [{ label: 'clg', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'console.log(${1});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'console.log', range }] };
      },
    });
  };

  const handleFileSelect = (nodeId: string) => {
    const file = files.find((f) => f.id === nodeId);
    if (file) dispatch(setActiveFile(file));
  };

  const handleCloseTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(closeFile(fileId));
    setDirty((d) => { const next = { ...d }; delete next[fileId]; return next; });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!canEdit || !activeFile || value === undefined) return;
    dispatch(patchFileContent({ id: activeFile.id, content: value }));
    setDirty((d) => ({ ...d, [activeFile.id]: true }));
    setSaveStatus('idle');

    if (isCollabEligible) {
      const fileId = activeFile.id;
      if (codeChangeTimerRef.current) clearTimeout(codeChangeTimerRef.current);
      codeChangeTimerRef.current = setTimeout(() => {
        const socket = getCollabSocket();
        if (socket?.connected) socket.emit('code-change', { fileId, content: value });
      }, 150);
    }
  };

  const handleSave = useCallback(async () => {
    if (!canEdit || !activeFile || !dirty[activeFile.id]) return;
    setSaveStatus('saving');
    try {
      await dispatch(updateFile({ id: activeFile.id, data: { content: activeFile.content } }));
      setDirty((d) => ({ ...d, [activeFile.id]: false }));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { setSaveStatus('error'); }
  }, [activeFile, dirty, dispatch, canEdit]);

  const handleSaveAll = async () => {
    if (!canEdit) return;
    for (const f of openFiles.filter((f) => dirty[f.id])) {
      await dispatch(updateFile({ id: f.id, data: { content: f.content } }));
      setDirty((d) => ({ ...d, [f.id]: false }));
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const isUpgradeError = (err: unknown): { upgrade: boolean; message: string } => {
    const e = err as { upgrade?: boolean; message?: string };
    return { upgrade: !!e?.upgrade, message: e?.message || 'Action failed.' };
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !activeProject || !canEdit) return;
    try {
      await dispatch(createFile({
        fileName: newFileName.trim(),
        content: '',
        projectId: activeProject.id,
        folderId: newItemParentId,
      })).unwrap();
      setNewFileName(''); setShowNewFile(false); setNewItemParentId(null);
    } catch (err: unknown) {
      const { upgrade, message } = isUpgradeError(err);
      if (upgrade) { setShowNewFile(false); setUpgradeReason(message); setShowUpgrade(true); }
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !activeProject || !canEdit) return;
    try {
      await dispatch(createFolder({
        name: newFolderName.trim(),
        projectId: activeProject.id,
        parentId: newItemParentId,
      })).unwrap();
      setNewFolderName(''); setShowNewFolder(false); setNewItemParentId(null);
    } catch (err: unknown) {
      const { upgrade, message } = isUpgradeError(err);
      if (upgrade) { setShowNewFolder(false); setUpgradeReason(message); setShowUpgrade(true); }
    }
  };

  const handleRenameSubmit = async () => {
    if (!renaming || !renameValue.trim() || !canEdit) { setRenaming(null); return; }
    if (renaming.type === 'folder') {
      await dispatch(renameFolder({ id: renaming.id, name: renameValue.trim() }));
    } else {
      await dispatch(updateFile({ id: renaming.id, data: { fileName: renameValue.trim() } }));
    }
    setRenaming(null); setRenameValue('');
  };

  const handleDeleteFolderClick = async (folderId: string) => {
    if (!canEdit) return;
    setContextMenu(null);
    if (!window.confirm('Delete this folder and everything inside it? This cannot be undone.')) return;
    await dispatch(deleteFolder(folderId));
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!canEdit) return;
    await dispatch(deleteFile(fileId));
    setContextMenu(null);
  };

  // ✅ FIXED handleRun — sends { fileName, content } and now tracks the
  // sessionId the backend hands back so we can keep feeding stdin to a
  // program that's still waiting on input (e.g. Python's input(), Java's
  // Scanner, C's scanf) instead of leaving it stuck forever.
  const handleRun = async () => {
    if (!activeFile) return;

    if (!canRunFile(activeFile.fileName)) {
      setRunState({ running: false, stdout: '', stderr: `Cannot run "${activeFile.fileName}" directly.\nRunnable: .js .ts .py .java .c .cpp .go .rs .sh`, exitCode: 1, fileName: activeFile.fileName, sessionId: null, exited: true });
      setShowRunOutput(true);
      setShowTerminal(true);
      return;
    }

    // If a previous run is still alive (waiting on stdin), kill it before
    // starting a fresh one so we don't leak Docker containers.
    if (runSessionIdRef.current) {
      const staleId = runSessionIdRef.current;
      runSessionIdRef.current = null;
      apiFetch('/api/terminal/kill', { method: 'POST', body: JSON.stringify({ sessionId: staleId }) }).catch(() => {});
    }

    setRunStdinInput('');
    setRunState({ running: true, stdout: '', stderr: '', exitCode: null, fileName: activeFile.fileName, sessionId: null, exited: false });
    setShowRunOutput(true);
    setShowTerminal(true);

    try {
      const resp = await apiFetch<ExecuteResponse>(
        '/api/terminal/execute',
        {
          method: 'POST',
          // ✅ Send fileName + content — backend writes file to disk and runs it
          body: JSON.stringify({
            fileName: activeFile.fileName,
            content:  activeFile.content,
          }),
        }
      );

      if (resp.success && resp.data) {
        const { stdout, stderr, exitCode, sessionId, exited } = resp.data;
        runSessionIdRef.current = exited ? null : (sessionId ?? null);
        setRunState({
          running:   false,
          stdout:    stdout || '',
          stderr:    stderr || '',
          exitCode:  exited ? exitCode : null,
          fileName:  activeFile.fileName,
          sessionId: exited ? null : (sessionId ?? null),
          exited:    !!exited,
        });
      } else {
        runSessionIdRef.current = null;
        setRunState({ running: false, stdout: '', stderr: resp.message || 'Execution failed.', exitCode: 1, fileName: activeFile.fileName, sessionId: null, exited: true });
      }
    } catch (e: unknown) {
      runSessionIdRef.current = null;
      setRunState({ running: false, stdout: '', stderr: String(e), exitCode: 1, fileName: activeFile.fileName, sessionId: null, exited: true });
    }
  };

  // Send one line of stdin to the still-running session from the Run
  // Output panel — same wire contract Terminal.tsx already uses.
  const handleRunStdinSubmit = async () => {
    if (!runState || !runState.sessionId || runState.running) return;
    const value = runStdinInput;
    setRunStdinInput('');
    setRunState((s) => (s ? { ...s, running: true } : s));

    try {
      const resp = await apiFetch<ExecuteResponse>('/api/terminal/stdin', {
        method: 'POST',
        body: JSON.stringify({ sessionId: runState.sessionId, input: value }),
      });

      if (resp.success && resp.data) {
        const { stdout, stderr, exitCode, sessionId, exited } = resp.data;
        runSessionIdRef.current = exited ? null : (sessionId ?? runState.sessionId);
        setRunState((s) => s ? {
          ...s,
          running:   false,
          stdout:    s.stdout + (stdout || ''),
          stderr:    s.stderr + (stderr || ''),
          exitCode:  exited ? exitCode : null,
          sessionId: exited ? null : (sessionId ?? s.sessionId),
          exited:    !!exited,
        } : s);
      } else {
        runSessionIdRef.current = null;
        setRunState((s) => s ? { ...s, running: false, stderr: s.stderr + '\n' + (resp.message || 'Input failed.'), exited: true, sessionId: null, exitCode: 1 } : s);
      }
    } catch (e: unknown) {
      runSessionIdRef.current = null;
      setRunState((s) => s ? { ...s, running: false, stderr: s.stderr + '\n' + String(e), exited: true, sessionId: null, exitCode: 1 } : s);
    }
  };

  // Stop a still-running session early (e.g. an infinite loop, or a
  // program the user no longer wants to feed input to).
  const handleKillRun = async () => {
    const id = runState?.sessionId;
    runSessionIdRef.current = null;
    if (id) {
      apiFetch('/api/terminal/kill', { method: 'POST', body: JSON.stringify({ sessionId: id }) }).catch(() => {});
    }
    setRunState((s) => s ? { ...s, running: false, exited: true, sessionId: null, stderr: s.stderr + '\n[stopped by user]' } : s);
  };

  const handleSendToAI = (action: 'explain' | 'fix' | 'generate') => {
    if (!activeFile) return;
    const prompts = {
      explain:  `Explain this code:\n\n\`\`\`${getLang(activeFile.fileName)}\n${activeFile.content}\n\`\`\``,
      fix:      `Fix any bugs in this code:\n\n\`\`\`${getLang(activeFile.fileName)}\n${activeFile.content}\n\`\`\``,
      generate: `Improve or extend this code:\n\n\`\`\`${getLang(activeFile.fileName)}\n${activeFile.content}\n\`\`\``,
    };
    setAiContext(prompts[action]);
    setShowAI(true);
    setActivePanel('ai');
  };

  const handleAnalyzeCorrections = async () => {
    if (!activeFile) return;
    setCorrectionsLoading(true); setShowCorrections(true); setActivePanel('corrections');
    try {
      const result = await aiApi.correctCode(activeFile.content, getLang(activeFile.fileName));
      setCorrections(result);
    } catch { setCorrections({ issues: [{ type: 'error', message: 'Failed to analyze. Make sure Ollama is running.' }], correctedCode: activeFile.content, explanation: 'Error.' }); }
    finally { setCorrectionsLoading(false); }
  };

  const handleGetSuggestions = async () => {
    if (!activeFile) return;
    setSuggestionsLoading(true); setSuggestionsError(null); setShowCorrections(true); setActivePanel('corrections');
    try {
      const result = await aiApi.suggestCode(activeFile.content, getLang(activeFile.fileName));
      setSuggestions(result);
      if (result.length === 0) setSuggestionsError('Model returned no usable suggestions. Try again or check Ollama.');
    } catch (e: unknown) {
      setSuggestions([]);
      setSuggestionsError(e instanceof Error ? e.message : 'Failed to get suggestions. Make sure Ollama is running.');
    }
    finally { setSuggestionsLoading(false); }
  };

  const handleApplyCorrectedCode = (correctedCode: string) => {
    if (!activeFile) return;
    dispatch(patchFileContent({ id: activeFile.id, content: correctedCode }));
    setDirty((d) => ({ ...d, [activeFile.id]: true }));
  };

  const handleSelectSuggestion = (suggestion: CodeSuggestion) => {
    if (!activeFile) return;
    dispatch(patchFileContent({ id: activeFile.id, content: activeFile.content + '\n' + suggestion.text }));
    setDirty((d) => ({ ...d, [activeFile.id]: true }));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') { e.preventDefault(); handleSaveAll(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      else if (e.key === 'F5') { e.preventDefault(); handleRun(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSave, activeFile]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // Kill any still-running Run-panel session if the editor unmounts
  // (closed tab, navigated away, etc.) so we don't leak Docker containers.
  useEffect(() => {
    return () => {
      const id = runSessionIdRef.current;
      if (id) {
        apiFetch('/api/terminal/kill', { method: 'POST', body: JSON.stringify({ sessionId: id }) }).catch(() => {});
      }
    };
  }, []);

  // Pull focus to the stdin field the moment a run session is alive and
  // waiting on input — same "becomes obviously typeable" behavior as
  // Terminal.tsx's stdin mode.
  useEffect(() => {
    if (showRunOutput && runState && !runState.exited && runState.sessionId && !runState.running) {
      runStdinInputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRunOutput, runState?.sessionId, runState?.running, runState?.exited]);

  const saveColor = saveStatus === 'saved' ? '#00D4B8' : saveStatus === 'saving' ? '#F59E0B' : saveStatus === 'error' ? '#F87171' : '#6B7280';
  const saveText  = saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '⟳ Saving…' : saveStatus === 'error' ? '✕ Error' : '';
  const dirtyCount = Object.values(dirty).filter(Boolean).length;
  const monacoTheme = MONACO_THEMES[settings.appearance.theme] || 'vs-dark';

  const renderTree = (nodes: Array<FolderNode | FileLeafNode>, depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const indent = 8 + depth * 14;
      const isRenaming = renaming?.id === node.id && renaming.type === node.type;

      if (node.type === 'folder') {
        const open = expandedFolders[node.id] ?? true;
        return (
          <React.Fragment key={node.id}>
            <div className="flex items-center gap-1.5 cursor-pointer py-1 group hover:bg-white/5 transition-colors"
              style={{ paddingLeft: `${indent}px`, paddingRight: '8px' }}
              onClick={() => !isRenaming && setExpandedFolders((p) => ({ ...p, [node.id]: !open }))}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, type: 'folder' }); }}>
              <span className="text-xs" style={{ color: '#6B7280' }}>{open ? '▾' : '▸'}</span>
              <span className="text-xs" style={{ color: '#FBBF24' }}>📁</span>
              {isRenaming ? (
                <input autoFocus
                  className="text-xs flex-1 px-1 rounded outline-none text-white"
                  style={{ background: '#0A0A0F', border: '1px solid #FBBF24' }}
                  value={renameValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  onBlur={handleRenameSubmit}
                />
              ) : (
                <span className="text-xs truncate flex-1" style={{ color: '#9CA3AF' }}>{node.name}</span>
              )}
            </div>
            {open && renderTree(node.children as Array<FolderNode | FileLeafNode>, depth + 1)}
          </React.Fragment>
        );
      }
      const file = files.find((f) => f.id === node.id);
      return (
        <div key={node.id}
          className="flex items-center gap-2 cursor-pointer group transition-colors py-1"
          style={{ paddingLeft: `${indent}px`, paddingRight: '8px', background: activeFile?.id === node.id ? 'rgba(0,212,184,0.08)' : 'transparent', borderLeft: activeFile?.id === node.id ? '2px solid #00D4B8' : '2px solid transparent' }}
          onClick={() => !isRenaming && file && handleFileSelect(node.id)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, type: 'file' }); }}>
          <span className="text-xs">{getFileIcon(node.name)}</span>
          {isRenaming ? (
            <input autoFocus
              className="text-xs flex-1 px-1 rounded outline-none text-white"
              style={{ background: '#0A0A0F', border: '1px solid #00D4B8' }}
              value={renameValue}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setRenaming(null);
              }}
              onBlur={handleRenameSubmit}
            />
          ) : (
            <span className="text-xs truncate flex-1" style={{ color: activeFile?.id === node.id ? '#E2E8F0' : '#9CA3AF' }}>{node.name}</span>
          )}
          {dirty[node.id] && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} />}
        </div>
      );
    });

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      {remoteCursorColors.length > 0 && (
        <style>
          {remoteCursorColors.map((c) => `
            .remote-cursor-${c.replace('#', '')}::before {
              content: '';
              position: absolute;
              width: 2px;
              height: 100%;
              background: ${c};
              z-index: 20;
            }
          `).join('\n')}
        </style>
      )}
      <TopBar
        title={activeProject ? `📁 ${activeProject.name}` : 'Editor Workspace'}
        extra={
          <div className="flex items-center gap-2 flex-wrap">
            {isProjectOwner && (
              <button onClick={() => setShowShare(true)}
                className="px-2.5 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1"
                style={{
                  background: activeProject?.teamId ? 'rgba(0,212,184,0.1)' : '#1A1A26',
                  color: activeProject?.teamId ? '#00D4B8' : '#9CA3AF',
                  border: `1px solid ${activeProject?.teamId ? 'rgba(0,212,184,0.3)' : '#2A2A3A'}`,
                }}
                title="Share this project with a team for real-time collaboration">
                👥 {activeProject?.teamId ? 'Shared' : 'Share'}
              </button>
            )}
            {isViewer && (
              <span className="px-2 py-0.5 text-xs rounded-full" style={{ background: 'rgba(251,191,36,0.1)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }}>
                👁 View Only
              </span>
            )}
            {saveText && <span className="text-xs font-medium" style={{ color: saveColor }}>{saveText}</span>}

            {activeFile && (
              <div className="flex gap-1">
                {(['explain', 'fix', 'generate'] as const).map((action) => {
                  const cfg = {
                    explain:  { label: '✦ Explain', bg: 'rgba(0,212,184,0.1)',   color: '#00D4B8',  border: 'rgba(0,212,184,0.3)' },
                    fix:      { label: '🐛 Fix',     bg: 'rgba(248,113,113,0.1)', color: '#F87171',  border: 'rgba(248,113,113,0.3)' },
                    generate: { label: '⚡ Generate', bg: 'rgba(139,92,246,0.1)', color: '#A78BFA', border: 'rgba(139,92,246,0.3)' },
                  }[action];
                  return (
                    <button key={action} onClick={() => handleSendToAI(action)}
                      className="px-2 py-1 text-xs rounded transition-all"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            )}

            {activeFile && (
              <div className="flex gap-1">
                <button onClick={handleAnalyzeCorrections}
                  className="px-2 py-1 text-xs rounded transition-all"
                  style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7', border: '1px solid rgba(168,85,247,0.3)' }}>
                  🔍 Analyze
                </button>
                <button onClick={handleGetSuggestions}
                  className="px-2 py-1 text-xs rounded transition-all"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>
                  💡 Suggest
                </button>
              </div>
            )}

            {/* ✅ Run button — only shows for runnable file types */}
            {activeFile && canRunFile(activeFile.fileName) && (
              <button onClick={handleRun}
                disabled={runState?.running}
                className="px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1 disabled:opacity-60"
                style={{ background: '#4ADE80', color: '#0A0A0F' }}
                title="Run file (F5)">
                {runState?.running ? '⟳ Running…' : runState && !runState.exited && runState.sessionId ? '▶ Run again' : '▶ Run'}
              </button>
            )}

            {canEdit && (
              <button onClick={handleSave}
                disabled={!activeFile || !dirty[activeFile?.id]}
                className="px-3 py-1.5 text-xs rounded-md font-medium transition-all disabled:opacity-40"
                style={{ background: '#00D4B8', color: '#0A0A0F' }}>
                Save {dirtyCount > 0 ? `(${dirtyCount})` : ''}
              </button>
            )}

            <button onClick={() => { setShowTerminal(!showTerminal); if (showRunOutput) setShowRunOutput(false); }}
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
              style={{ background: showTerminal ? '#00D4B8' : '#1A1A26', color: showTerminal ? '#0A0A0F' : '#9CA3AF', border: '1px solid #2A2A3A' }}>
              &gt;_
            </button>
            <button onClick={() => { setShowCorrections(!showCorrections); if (!showCorrections) setActivePanel('corrections'); }}
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
              style={{ background: activePanel === 'corrections' ? 'rgba(168,85,247,0.15)' : '#1A1A26', color: activePanel === 'corrections' ? '#A855F7' : '#9CA3AF', border: activePanel === 'corrections' ? '1px solid rgba(168,85,247,0.3)' : '1px solid #2A2A3A' }}>
              🔍 Corrections
            </button>
            <button onClick={() => { setShowAI(!showAI); if (!showAI) setActivePanel('ai'); }}
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
              style={{ background: activePanel === 'ai' ? 'rgba(0,212,184,0.15)' : '#1A1A26', color: activePanel === 'ai' ? '#00D4B8' : '#9CA3AF', border: activePanel === 'ai' ? '1px solid rgba(0,212,184,0.3)' : '1px solid #2A2A3A' }}>
              ✦ AI
            </button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* File Explorer */}
        <div className="flex flex-col w-52 border-r overflow-hidden" style={{ background: '#0D0D16', borderColor: '#1A1A26' }}>
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A26' }}>
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>
              {activeProject?.name ?? 'Explorer'}
            </span>
            {activeProject && canEdit && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setNewItemParentId(null); setShowNewFolder(false); setShowNewFile((v) => !v); }}
                  className="text-xs hover:text-white px-1 transition-colors" style={{ color: '#6B7280' }} title="New file">
                  📄+
                </button>
                <button onClick={() => { setNewItemParentId(null); setShowNewFile(false); setShowNewFolder((v) => !v); }}
                  className="text-xs hover:text-white px-1 transition-colors" style={{ color: '#6B7280' }} title="New folder">
                  📁+
                </button>
              </div>
            )}
          </div>

          {showNewFile && (
            <div className="px-2 py-2 border-b" style={{ borderColor: '#1A1A26' }}>
              {newItemParentName && <p className="text-xs mb-1 truncate" style={{ color: '#6B7280' }}>📁 {newItemParentName}/</p>}
              <input autoFocus
                className="w-full px-2 py-1 text-xs rounded outline-none text-white"
                style={{ background: '#12121A', border: '1px solid #00D4B8' }}
                placeholder="filename.java"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFile();
                  if (e.key === 'Escape') { setShowNewFile(false); setNewFileName(''); setNewItemParentId(null); }
                }}
              />
              <p className="text-xs mt-1" style={{ color: '#3A3A50' }}>Enter · Esc to cancel</p>
            </div>
          )}

          {showNewFolder && (
            <div className="px-2 py-2 border-b" style={{ borderColor: '#1A1A26' }}>
              {newItemParentName && <p className="text-xs mb-1 truncate" style={{ color: '#6B7280' }}>📁 {newItemParentName}/</p>}
              <input autoFocus
                className="w-full px-2 py-1 text-xs rounded outline-none text-white"
                style={{ background: '#12121A', border: '1px solid #FBBF24' }}
                placeholder="New folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); setNewItemParentId(null); }
                }}
              />
              <p className="text-xs mt-1" style={{ color: '#3A3A50' }}>Enter · Esc to cancel</p>
            </div>
          )}

          <div className="flex-1 overflow-auto py-1">
            {filesLoading ? (
              <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>Loading…</p>
            ) : activeProject ? (
              tree.length > 0
                ? renderTree(tree)
                : <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>No files yet. Use 📄+ or 📁+ above.</p>
            ) : (
              <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>No project selected</p>
            )}
          </div>

          {files.length > 0 && (
            <div className="px-3 py-2 border-t" style={{ borderColor: '#1A1A26' }}>
              <p className="text-xs" style={{ color: '#3A3A50' }}>
                {files.length} file{files.length !== 1 ? 's' : ''}{folders.length > 0 ? ` · ${folders.length} folder${folders.length !== 1 ? 's' : ''}` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Editor Area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center border-b overflow-x-auto" style={{ borderColor: '#1A1A26', background: '#0D0D16', minHeight: '36px' }}>
            {openFiles.length === 0 && <span className="px-4 text-xs" style={{ color: '#3A3A50' }}>No open files</span>}
            {openFiles.map((file) => (
              <div key={file.id}
                className="flex items-center gap-2 px-4 py-2 cursor-pointer border-r text-xs whitespace-nowrap transition-all group"
                style={{ borderColor: '#1A1A26', background: activeFile?.id === file.id ? '#0A0A0F' : 'transparent', color: activeFile?.id === file.id ? '#E2E8F0' : '#6B7280', borderBottom: activeFile?.id === file.id ? '1px solid #00D4B8' : '1px solid transparent' }}
                onClick={() => dispatch(setActiveFile(file))}>
                <span className="text-xs">{getFileIcon(file.fileName)}</span>
                <span>{file.fileName}</span>
                {dirty[file.id] && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />}
                <button onClick={(e) => handleCloseTab(file.id, e)}
                  className="w-4 h-4 rounded hover:bg-gray-700 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#6B7280' }}>✕</button>
              </div>
            ))}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {activeFile ? (
              <>
                <div className="flex items-center gap-2 px-4 py-1 border-b text-xs" style={{ borderColor: '#1A1A26', background: '#0A0A0F', color: '#3A3A50' }}>
                  <span>{activeProject?.name}</span>
                  <span>›</span>
                  <span style={{ color: '#6B7280' }}>{activeFile.fileName}</span>
                  {isCollabEligible && collaborators.length > 0 && (
                    <div className="flex items-center -space-x-1.5 ml-2" title="Live collaborators">
                      {collaborators.map((c) => (
                        <div key={c.userId}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
                          style={{ background: c.color, color: '#0A0A0F', borderColor: '#0A0A0F' }}
                          title={c.name}>
                          {c.name[0]?.toUpperCase()}
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="ml-auto" style={{ color: '#3A3A50' }}>{getLang(activeFile.fileName)}</span>
                  {isViewer && <span className="text-xs" style={{ color: '#FBBF24' }}>read-only</span>}
                  {canRunFile(activeFile.fileName) && <span className="text-xs" style={{ color: '#4ADE80' }}>● runnable</span>}
                </div>
                <div className="flex-1" style={{ minHeight: 0 }}>
                  <Editor
                    height="100%"
                    language={getLang(activeFile.fileName)}
                    value={activeFile.content}
                    onChange={handleEditorChange}
                    theme={monacoTheme}
                    onMount={handleEditorMount}
                    options={{
                      fontSize: settings.editor.fontSize,
                      fontFamily: `'${settings.editor.fontFamily}', 'JetBrains Mono', monospace`,
                      fontLigatures: true,
                      minimap: { enabled: settings.editor.minimap },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: settings.editor.tabSize,
                      wordWrap: settings.editor.wordWrap,
                      lineNumbers: settings.editor.lineNumbers ? 'on' : 'off',
                      renderLineHighlight: 'gutter',
                      cursorBlinking: 'smooth',
                      smoothScrolling: true,
                      padding: { top: 12 },
                      bracketPairColorization: { enabled: true },
                      guides: { bracketPairs: true },
                      suggest: { showKeywords: true, showSnippets: true, showMethods: true, showFunctions: true, showVariables: true, showClasses: true, showModules: true },
                      quickSuggestions: { other: true, comments: false, strings: true },
                      parameterHints: { enabled: true },
                      acceptSuggestionOnEnter: 'on',
                      suggestOnTriggerCharacters: true,
                      formatOnPaste: settings.editor.formatOnSave,
                      formatOnType: settings.editor.formatOnSave,
                      readOnly: isViewer,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center" style={{ color: '#3A3A50' }}>
                <p className="text-4xl mb-3">{'</>'}</p>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>No file opened</p>
                <p className="text-xs">Select a file or press + to create one</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {[['Ctrl+S','save'], ['Ctrl+Shift+S','save all'], ['F5','run']].map(([key, label]) => (
                    <React.Fragment key={key}>
                      <kbd className="px-2 py-1 text-xs rounded" style={{ background: '#1A1A26', color: '#6B7280', border: '1px solid #2A2A3A' }}>{key}</kbd>
                      <span className="text-xs self-center" style={{ color: '#3A3A50' }}>{label}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* ✅ Terminal / Run Output panel */}
            {showTerminal && (
              <div style={{ height: '220px', borderTop: '1px solid #1A1A26' }}>
                {showRunOutput && runState ? (
                  /* ── Run output view ── */
                  <div className="h-full flex flex-col" style={{ background: '#080810' }}>
                    <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0" style={{ borderColor: '#1A1A26', background: '#0D0D16' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold" style={{ color: '#4ADE80' }}>
                          ▶ {runState.fileName}
                        </span>
                        {!runState.running && runState.exited && runState.exitCode !== null && (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: runState.exitCode === 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                              color:      runState.exitCode === 0 ? '#4ADE80' : '#F87171',
                              border:     `1px solid ${runState.exitCode === 0 ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                            }}>
                            Exit {runState.exitCode}
                          </span>
                        )}
                        {runState.running && (
                          <span className="text-xs animate-pulse" style={{ color: '#F59E0B' }}>● running in Docker…</span>
                        )}
                        {!runState.running && !runState.exited && runState.sessionId && (
                          <span className="text-xs px-2 py-0.5 rounded-full animate-pulse"
                            style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                            ● waiting for input
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!runState.exited && runState.sessionId && (
                          <button onClick={handleKillRun}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                            ■ Stop
                          </button>
                        )}
                        <button onClick={handleRun} disabled={runState.running}
                          className="text-xs px-2 py-1 rounded disabled:opacity-40"
                          style={{ background: 'rgba(74,222,128,0.1)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.3)' }}>
                          ↺ Re-run
                        </button>
                        <button onClick={() => setShowRunOutput(false)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: '#1A1A26', color: '#6B7280', border: '1px solid #2A2A3A' }}>
                          Terminal
                        </button>
                        <button onClick={() => setShowTerminal(false)} className="text-xs" style={{ color: '#6B7280' }}>✕</button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto p-3 font-mono text-xs leading-6">
                      {runState.running && !runState.stdout && !runState.stderr ? (
                        <span style={{ color: '#F59E0B' }}>Compiling and running in Docker sandbox…</span>
                      ) : (
                        <>
                          {runState.stdout && (
                            <pre className="whitespace-pre-wrap break-words" style={{ color: '#CBD5E1' }}>{runState.stdout}</pre>
                          )}
                          {runState.stderr && (
                            <pre className="whitespace-pre-wrap break-words mt-2" style={{ color: runState.exitCode === 0 ? '#F59E0B' : '#F87171' }}>{runState.stderr}</pre>
                          )}
                          {!runState.stdout && !runState.stderr && !runState.running && (
                            <span style={{ color: '#6B7280' }}>No output.</span>
                          )}
                        </>
                      )}
                    </div>

                    {/* ✅ Stdin input — appears once the program is alive and waiting on input,
                        mirroring Terminal.tsx's session-based stdin flow. */}
                    {!runState.exited && runState.sessionId && (
                      <div
                        className="px-3 py-2 border-t flex items-center gap-2 flex-shrink-0"
                        style={{ borderTop: '1px solid #F59E0B', background: 'rgba(245, 158, 11, 0.08)' }}
                      >
                        <span style={{ color: '#F59E0B', fontWeight: 700 }}>&gt;</span>
                        <input
                          ref={runStdinInputRef}
                          value={runStdinInput}
                          onChange={(e) => setRunStdinInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRunStdinSubmit(); }}
                          disabled={runState.running}
                          placeholder="Program is waiting for input…"
                          className="flex-1 bg-transparent outline-none text-xs font-mono"
                          style={{ color: '#E2E8F0' }}
                        />
                        <span className="text-xs" style={{ color: '#F59E0B' }}>↵ send</span>
                      </div>
                    )}

                    <div className="px-4 py-1 border-t flex items-center gap-2 flex-shrink-0" style={{ borderColor: '#1A1A26', background: '#0D0D16' }}>
                      <span className="text-xs" style={{ color: '#3A3A50' }}>🐳 Docker sandbox · no network · 256MB · 20s limit</span>
                    </div>
                  </div>
                ) : (
                  /* ── Normal Terminal ── */
                  <Terminal onClose={() => setShowTerminal(false)} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI / Corrections Panel */}
        {(showAI || showCorrections) && (
          <div className="w-72 border-l overflow-y-auto" style={{ borderColor: '#1A1A26', background: '#0A0A0F' }}>
            {activePanel === 'ai' && showAI && (
              <AIAssistant compact initialMessage={aiContext} onContextConsumed={() => setAiContext('')} />
            )}
            {activePanel === 'corrections' && showCorrections && (
              <div className="p-4 space-y-4">
                {/* ✅ FIXED: was `suggestions.length > 0 && (...)` — that hid the
                    panel (and its loading spinner) for the entire Ollama
                    round-trip, since `suggestions` stays [] until a response
                    arrives. Now renders as soon as a request starts. */}
                {(suggestionsLoading || suggestions.length > 0 || suggestionsError) && (
                  <CodeSuggestions
                    suggestions={suggestions}
                    onSelectSuggestion={handleSelectSuggestion}
                    loading={suggestionsLoading}
                    error={suggestionsError}
                  />
                )}
                {/* ✅ FIXED: was `corrections && (...)` — same issue, `corrections`
                    stays null until the response lands. */}
                {(correctionsLoading || corrections) && (
                  <CodeCorrections correction={corrections} onApplyCorrectedCode={handleApplyCorrectedCode} loading={correctionsLoading} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div className="fixed z-50 rounded-lg shadow-xl overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x, background: '#1A1A26', border: '1px solid #2A2A3A', minWidth: '170px' }}>
          {contextMenu.type === 'folder' && canEdit && (
            <>
              <button className="w-full px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors" style={{ color: '#9CA3AF' }}
                onClick={() => { setNewItemParentId(contextMenu.nodeId); setShowNewFolder(false); setShowNewFile(true); setContextMenu(null); }}>
                📄 New File Here
              </button>
              <button className="w-full px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors" style={{ color: '#9CA3AF' }}
                onClick={() => { setNewItemParentId(contextMenu.nodeId); setShowNewFile(false); setShowNewFolder(true); setContextMenu(null); }}>
                📁 New Folder Here
              </button>
              <button className="w-full px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors border-t" style={{ color: '#9CA3AF', borderColor: '#2A2A3A' }}
                onClick={() => {
                  const f = folders.find((x) => x.id === contextMenu.nodeId);
                  setRenaming({ id: contextMenu.nodeId, type: 'folder' });
                  setRenameValue(f?.name || '');
                  setContextMenu(null);
                }}>
                ✏️ Rename
              </button>
              <button className="w-full px-3 py-2 text-xs text-left hover:bg-red-900/20 transition-colors border-t" style={{ color: '#F87171', borderColor: '#2A2A3A' }}
                onClick={() => handleDeleteFolderClick(contextMenu.nodeId)}>
                🗑 Delete Folder
              </button>
            </>
          )}
          {contextMenu.type === 'file' && canEdit && (
            <>
              <button className="w-full px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors" style={{ color: '#9CA3AF' }}
                onClick={() => {
                  const f = files.find((x) => x.id === contextMenu.nodeId);
                  setRenaming({ id: contextMenu.nodeId, type: 'file' });
                  setRenameValue(f?.fileName || '');
                  setContextMenu(null);
                }}>
                ✏️ Rename
              </button>
              <button className="w-full px-3 py-2 text-xs text-left hover:bg-red-900/20 transition-colors border-t" style={{ color: '#F87171', borderColor: '#2A2A3A' }}
                onClick={() => handleDeleteFile(contextMenu.nodeId)}>
                🗑 Delete File
              </button>
            </>
          )}
        </div>
      )}

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} reason={upgradeReason} />}

      {showShare && activeProject && (
        <ShareProjectModal
          project={activeProject}
          teams={teams}
          onClose={() => setShowShare(false)}
          onShare={async (teamId) => {
            await dispatch(updateProject({ id: activeProject.id, data: { teamId } })).unwrap();
          }}
        />
      )}
    </div>
  );
};

export default EditorPage;
