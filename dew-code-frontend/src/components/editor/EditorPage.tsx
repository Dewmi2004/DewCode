// ✅ FIXED EditorPage.tsx
// Key fix: handleRun now sends { fileName, content } to the backend
// instead of building a broken shell command string.
// The backend writes the file to disk and runs it in Docker.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchFiles, setActiveFile, closeFile,
  createFile, updateFile, deleteFile, patchFileContent,
} from '../../store/slices/projectSlice';
import { FileNode, CodeCorrection, CodeSuggestion } from '../../types';
import Terminal from '../terminal/Terminal';
import AIAssistant from '../ai/AIAssistant';
import CodeCorrections from './CodeCorrections';
import CodeSuggestions from './CodeSuggestions';
import TopBar from '../layout/TopBar';
import apiFetch from '../../services/api';
import { aiApi } from '../../services/aiApi';

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

const buildTree = (fileNames: Array<{ id: string; fileName: string }>): Array<FolderNode | FileLeafNode> => {
  const root: Array<FolderNode | FileLeafNode> = [];
  const folderMap: Record<string, FolderNode> = {};
  fileNames.forEach(({ id, fileName }) => {
    const parts = fileName.split('/');
    if (parts.length === 1) {
      root.push({ id, name: fileName, type: 'file', path: fileName });
    } else {
      let current = root;
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        currentPath = currentPath ? `${currentPath}/${seg}` : seg;
        let folder = folderMap[currentPath];
        if (!folder) {
          folder = { id: `folder-${currentPath}`, name: seg, type: 'folder', children: [], path: currentPath };
          folderMap[currentPath] = folder;
          current.push(folder);
        }
        current = folder.children as Array<FolderNode | FileLeafNode>;
      }
      current.push({ id, name: parts[parts.length - 1], type: 'file', path: fileName });
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
  const { activeProject, files, openFiles, activeFile, filesLoading } = useAppSelector((s) => s.projects);
  const { user }     = useAppSelector((s) => s.auth);
  const settings     = useAppSelector((s) => s.settings.settings);

  const isViewer = user?.role === 'Viewer';
  const canEdit  = !isViewer;

  const [showTerminal,   setShowTerminal]   = useState(true);
  const [showAI,         setShowAI]         = useState(true);
  const [newFileName,    setNewFileName]    = useState('');
  const [showNewFile,    setShowNewFile]    = useState(false);
  const [newFileParent,  setNewFileParent]  = useState('');
  const [dirty,          setDirty]          = useState<DirtyMap>({});
  const [saveStatus,     setSaveStatus]     = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [contextMenu,    setContextMenu]    = useState<{ x: number; y: number; fileId: string; type: 'file'|'folder'; folderPath?: string } | null>(null);
  const [aiContext,      setAiContext]       = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showCorrections, setShowCorrections] = useState(false);
  const [corrections,     setCorrections]     = useState<CodeCorrection | null>(null);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [suggestions,    setSuggestions]    = useState<CodeSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
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

  useEffect(() => {
    if (activeProject) dispatch(fetchFiles(activeProject.id));
  }, [activeProject?.id, dispatch]);

  const tree = buildTree(files.map((f) => ({ id: f.id, fileName: f.fileName })));

  const handleEditorMount = (_editor: unknown, monaco: Monaco) => {
    monacoRef.current = monaco;
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

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !activeProject || !canEdit) return;
    const fullName = newFileParent ? `${newFileParent}/${newFileName.trim()}` : newFileName.trim();
    await dispatch(createFile({ fileName: fullName, content: '', projectId: activeProject.id }));
    setNewFileName(''); setShowNewFile(false); setNewFileParent('');
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
    setSuggestionsLoading(true); setShowCorrections(true); setActivePanel('corrections');
    try {
      const result = await aiApi.suggestCode(activeFile.content, getLang(activeFile.fileName));
      setSuggestions(result);
    } catch { setSuggestions([]); }
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
  }, [showRunOutput, runState?.sessionId, runState?.running, runState?.exited]);

  const saveColor = saveStatus === 'saved' ? '#00D4B8' : saveStatus === 'saving' ? '#F59E0B' : saveStatus === 'error' ? '#F87171' : '#6B7280';
  const saveText  = saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '⟳ Saving…' : saveStatus === 'error' ? '✕ Error' : '';
  const dirtyCount = Object.values(dirty).filter(Boolean).length;
  const monacoTheme = MONACO_THEMES[settings.appearance.theme] || 'vs-dark';

  const renderTree = (nodes: Array<FolderNode | FileLeafNode>, depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const indent = 8 + depth * 14;
      if (node.type === 'folder') {
        const open = expandedFolders[node.path] ?? true;
        return (
          <React.Fragment key={node.id}>
            <div className="flex items-center gap-1.5 cursor-pointer py-1 group hover:bg-white/5 transition-colors"
              style={{ paddingLeft: `${indent}px`, paddingRight: '8px' }}
              onClick={() => setExpandedFolders((p) => ({ ...p, [node.path]: !open }))}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, fileId: node.id, type: 'folder', folderPath: node.path }); }}>
              <span className="text-xs" style={{ color: '#6B7280' }}>{open ? '▾' : '▸'}</span>
              <span className="text-xs" style={{ color: '#FBBF24' }}>📁</span>
              <span className="text-xs truncate flex-1" style={{ color: '#9CA3AF' }}>{node.name}</span>
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
          onClick={() => file && handleFileSelect(node.id)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, fileId: node.id, type: 'file' }); }}>
          <span className="text-xs">{getFileIcon(node.name)}</span>
          <span className="text-xs truncate flex-1" style={{ color: activeFile?.id === node.id ? '#E2E8F0' : '#9CA3AF' }}>{node.name}</span>
          {dirty[node.id] && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} />}
        </div>
      );
    });

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <TopBar
        title={activeProject ? `📁 ${activeProject.name}` : 'Editor Workspace'}
        extra={
          <div className="flex items-center gap-2 flex-wrap">
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
              <button onClick={() => { setNewFileParent(''); setShowNewFile((v) => !v); }}
                className="text-xs hover:text-white px-1 transition-colors" style={{ color: '#6B7280' }} title="New file">
                +
              </button>
            )}
          </div>

          {showNewFile && (
            <div className="px-2 py-2 border-b" style={{ borderColor: '#1A1A26' }}>
              {newFileParent && <p className="text-xs mb-1 truncate" style={{ color: '#6B7280' }}>📁 {newFileParent}/</p>}
              <input autoFocus
                className="w-full px-2 py-1 text-xs rounded outline-none text-white"
                style={{ background: '#12121A', border: '1px solid #00D4B8' }}
                placeholder="filename.java or folder/Main.java"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFile();
                  if (e.key === 'Escape') { setShowNewFile(false); setNewFileName(''); }
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
                : <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>No files. Press + to create.</p>
            ) : (
              <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>No project selected</p>
            )}
          </div>

          {files.length > 0 && (
            <div className="px-3 py-2 border-t" style={{ borderColor: '#1A1A26' }}>
              <p className="text-xs" style={{ color: '#3A3A50' }}>{files.length} file{files.length !== 1 ? 's' : ''}</p>
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
                {suggestions.length > 0 && (
                  <CodeSuggestions suggestions={suggestions} onSelectSuggestion={handleSelectSuggestion} loading={suggestionsLoading} />
                )}
                {corrections && (
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
          style={{ top: contextMenu.y, left: contextMenu.x, background: '#1A1A26', border: '1px solid #2A2A3A', minWidth: '160px' }}>
          {contextMenu.type === 'folder' && canEdit && (
            <button className="w-full px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors" style={{ color: '#9CA3AF' }}
              onClick={() => { setNewFileParent(contextMenu.folderPath || ''); setShowNewFile(true); setContextMenu(null); }}>
              📄 New File Here
            </button>
          )}
          {contextMenu.type === 'file' && canEdit && (
            <button className="w-full px-3 py-2 text-xs text-left hover:bg-red-900/20 transition-colors" style={{ color: '#F87171' }}
              onClick={() => handleDeleteFile(contextMenu.fileId)}>
              🗑 Delete File
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorPage;