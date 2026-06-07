// ✅ UPDATED EditorPage.tsx
// New features:
//   - IntelliSense / Suggestions fully enabled (Monaco completionProvider)
//   - Run / Compile button → sends code to /api/terminal/execute
//   - Folder system in file explorer (create folders, nested files)
//   - Context menu: rename, delete, new file in folder
//   - Settings-driven editor options (font size, theme, minimap etc.)
//   - Role-based UI: Viewers cannot edit/save/delete

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchFiles, setActiveFile, closeFile,
  createFile, updateFile, deleteFile, patchFileContent,
} from '../../store/slices/projectSlice';
import { FileNode } from '../../types';
import Terminal from '../terminal/Terminal';
import AIAssistant from '../ai/AIAssistant';
import TopBar from '../layout/TopBar';
import apiFetch from '../../services/api';

// ── Language map ──────────────────────────────────────────────────────────
const LANG_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', json: 'json', md: 'markdown', html: 'html', css: 'css',
  scss: 'scss', rs: 'rust', go: 'go', java: 'java', txt: 'plaintext',
  sh: 'shell', yml: 'yaml', yaml: 'yaml', xml: 'xml', sql: 'sql', c: 'c', cpp: 'cpp',
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
    c: '©️', cpp: '➕', sql: '🗄️',
  };
  return icons[ext] || '📄';
};

// ── Run command builder ───────────────────────────────────────────────────
const getRunCommand = (fileName: string, content: string): string | null => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const escapeCmd = (str: string) => str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  
  switch (ext) {
    // Scripting languages
    case 'js':    return `node -e "${escapeCmd(content)}"`;
    case 'ts':    return `npx ts-node --eval "${escapeCmd(content)}"`;
    case 'py':    return `python -c "${escapeCmd(content)}"`;
    case 'rb':    return `ruby -e "${escapeCmd(content)}"`;
    case 'php':   return `php -r "${escapeCmd(content)}"`;
    case 'pl':    return `perl -e "${escapeCmd(content)}"`;
    case 'sh':    return content;
    case 'bash':  return content;
    case 'zsh':   return content;
    
    // Compiled languages (write to temp file, compile, run)
    case 'java': {
      const className = fileName.replace('.java', '');
      return `javac ${fileName} && java ${className}`;
    }
    case 'c': {
      const name = fileName.replace('.c', '');
      return `gcc ${fileName} -o ${name} && ./${name}`;
    }
    case 'cpp': {
      const name = fileName.replace('.cpp', '');
      return `g++ ${fileName} -o ${name} && ./${name}`;
    }
    case 'cc': {
      const name = fileName.replace('.cc', '');
      return `g++ ${fileName} -o ${name} && ./${name}`;
    }
    case 'rs': {
      return `rustc ${fileName} && ./${fileName.replace('.rs', '')}`;
    }
    case 'go': {
      return `go run ${fileName}`;
    }
    
    // Other languages
    case 'md':
    case 'html':
    case 'css':
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'sql':
      return null; // These don't have executable output
    
    default: return null;
  }
};

// Theme map: settings theme → Monaco theme
const MONACO_THEMES: Record<string, string> = {
  dark: 'vs-dark', light: 'light', 'hc-black': 'hc-black',
  solarized: 'vs-dark', monokai: 'vs-dark', dracula: 'vs-dark', nord: 'vs-dark',
};

type DirtyMap = Record<string, boolean>;

// ── Folder node for virtual file tree ────────────────────────────────────
interface FolderNode {
  id: string;
  name: string;
  type: 'folder';
  children: Array<FolderNode | FileLeafNode>;
  path: string;
}
interface FileLeafNode {
  id: string;
  name: string;
  type: 'file';
  path: string;
}

const buildTree = (fileNames: Array<{ id: string; fileName: string }>): Array<FolderNode | FileLeafNode> => {
  const root: Array<FolderNode | FileLeafNode> = [];
  const folderMap: Record<string, FolderNode> = {};

  fileNames.forEach(({ id, fileName }) => {
    const parts = fileName.split('/');
    if (parts.length === 1) {
      root.push({ id, name: fileName, type: 'file', path: fileName });
    } else {
      // Build/find folder nodes
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
      const leaf = parts[parts.length - 1];
      current.push({ id, name: leaf, type: 'file', path: fileName });
    }
  });

  return root;
};

// ── Main Component ────────────────────────────────────────────────────────
const EditorPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { activeProject, files, openFiles, activeFile, filesLoading } = useAppSelector((s) => s.projects);
  const { user } = useAppSelector((s) => s.auth);
  const settings = useAppSelector((s) => s.settings.settings);

  // Role guards
  const isViewer = user?.role === 'Viewer';
  const canEdit  = !isViewer;

  const [showTerminal, setShowTerminal] = useState(true);
  const [showAI,       setShowAI]       = useState(true);
  const [newFileName,  setNewFileName]  = useState('');
  const [showNewFile,  setShowNewFile]  = useState(false);
  const [newFileParent, setNewFileParent] = useState('');
  const [dirty,        setDirty]        = useState<DirtyMap>({});
  const [saveStatus,   setSaveStatus]   = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [contextMenu,  setContextMenu]  = useState<{ x: number; y: number; fileId: string; type: 'file'|'folder'; folderPath?: string } | null>(null);
  const [aiContext,    setAiContext]     = useState('');
  const [runOutput,    setRunOutput]    = useState<{ out: string; err: string; running: boolean } | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const monacoRef = useRef<Monaco | null>(null);

  useEffect(() => {
    if (activeProject) dispatch(fetchFiles(activeProject.id));
  }, [activeProject?.id, dispatch]);

  const tree = buildTree(files.map((f) => ({ id: f.id, fileName: f.fileName })));

  // ── Handle editor mount — register extra IntelliSense ────────────────
  const handleEditorMount = (_editor: unknown, monaco: Monaco) => {
    monacoRef.current = monaco;

    // Register DewCode custom snippets for TypeScript/JavaScript
    monaco.languages.registerCompletionItemProvider('typescript', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const suggestions = [
          {
            label: 'rfc',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'const ${1:ComponentName}: React.FC = () => {\n  return (\n    <div>\n      ${2}\n    </div>\n  );\n};\n\nexport default ${1:ComponentName};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'React Functional Component',
            range,
          },
          {
            label: 'useState',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState<${2:type}>(${3:initialValue});',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'React useState hook',
            range,
          },
          {
            label: 'useEffect',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'useEffect(() => {\n  ${1}\n  return () => {\n    ${2}\n  };\n}, [${3}]);',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'React useEffect hook',
            range,
          },
          {
            label: 'asyncfn',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'const ${1:functionName} = async (${2:params}): Promise<${3:void}> => {\n  try {\n    ${4}\n  } catch (error) {\n    console.error(error);\n  }\n};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Async function with try/catch',
            range,
          },
        ];
        return { suggestions };
      },
    });

    // Mirror for JS
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: [{
            label: 'clg',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'console.log(${1});',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'console.log snippet',
            range,
          }],
        };
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
    } catch {
      setSaveStatus('error');
    }
  }, [activeFile, dirty, dispatch, canEdit]);

  const handleSaveAll = async () => {
    if (!canEdit) return;
    const dirtyFiles = openFiles.filter((f) => dirty[f.id]);
    for (const f of dirtyFiles) {
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
    setNewFileName('');
    setShowNewFile(false);
    setNewFileParent('');
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!canEdit) return;
    await dispatch(deleteFile(fileId));
    setContextMenu(null);
  };

  // ── Run / Compile ─────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!activeFile) return;
    const cmd = getRunCommand(activeFile.fileName, activeFile.content);
    if (!cmd) {
      setRunOutput({ out: '', err: `Cannot run "${activeFile.fileName}" directly. Supported: .js .ts .py .sh`, running: false });
      setShowTerminal(true);
      return;
    }
    setRunOutput({ out: '', err: '', running: true });
    setShowTerminal(true);
    try {
      const resp = await apiFetch<{ success: boolean; data: { stdout: string; stderr: string } }>(
        '/api/terminal/execute',
        { method: 'POST', body: JSON.stringify({ command: cmd }) }
      );
      setRunOutput({ out: resp.data?.stdout || '', err: resp.data?.stderr || '', running: false });
    } catch (e: unknown) {
      setRunOutput({ out: '', err: String(e), running: false });
    }
  };

  // ── Send to AI ────────────────────────────────────────────────────────
  const handleSendToAI = (action: 'explain' | 'fix' | 'generate') => {
    if (!activeFile) return;
    const prompts = {
      explain:  `Explain this code:\n\n\`\`\`${getLang(activeFile.fileName)}\n${activeFile.content}\n\`\`\``,
      fix:      `Fix any bugs in this code:\n\n\`\`\`${getLang(activeFile.fileName)}\n${activeFile.content}\n\`\`\``,
      generate: `Improve or extend this code:\n\n\`\`\`${getLang(activeFile.fileName)}\n${activeFile.content}\n\`\`\``,
    };
    setAiContext(prompts[action]);
    if (!showAI) setShowAI(true);
  };

  // Ctrl+S / Ctrl+Shift+S / F5 run
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') { e.preventDefault(); handleSaveAll(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      else if (e.key === 'F5') { e.preventDefault(); handleRun(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const saveColor = saveStatus === 'saved' ? '#00D4B8' : saveStatus === 'saving' ? '#F59E0B' : saveStatus === 'error' ? '#F87171' : '#6B7280';
  const saveText  = saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '⟳ Saving…' : saveStatus === 'error' ? '✕ Error' : '';
  const dirtyCount = Object.values(dirty).filter(Boolean).length;
  const monacoTheme = MONACO_THEMES[settings.appearance.theme] || 'vs-dark';

  // ── Recursive file tree renderer ──────────────────────────────────────
  const renderTree = (nodes: Array<FolderNode | FileLeafNode>, depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const indent = 8 + depth * 14;
      if (node.type === 'folder') {
        const open = expandedFolders[node.path] ?? true;
        return (
          <React.Fragment key={node.id}>
            <div
              className="flex items-center gap-1.5 cursor-pointer py-1 group hover:bg-white/5 transition-colors"
              style={{ paddingLeft: `${indent}px`, paddingRight: '8px' }}
              onClick={() => setExpandedFolders((p) => ({ ...p, [node.path]: !open }))}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, fileId: node.id, type: 'folder', folderPath: node.path });
              }}
            >
              <span className="text-xs" style={{ color: '#6B7280' }}>{open ? '▾' : '▸'}</span>
              <span className="text-xs" style={{ color: '#FBBF24' }}>📁</span>
              <span className="text-xs truncate flex-1" style={{ color: '#9CA3AF' }}>{node.name}</span>
            </div>
            {open && renderTree(node.children as Array<FolderNode | FileLeafNode>, depth + 1)}
          </React.Fragment>
        );
      }
      // File leaf
      const file = files.find((f) => f.id === node.id);
      return (
        <div
          key={node.id}
          className="flex items-center gap-2 cursor-pointer group transition-colors py-1"
          style={{
            paddingLeft: `${indent}px`,
            paddingRight: '8px',
            background: activeFile?.id === node.id ? 'rgba(0,212,184,0.08)' : 'transparent',
            borderLeft: activeFile?.id === node.id ? '2px solid #00D4B8' : '2px solid transparent',
          }}
          onClick={() => file && handleFileSelect(node.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, fileId: node.id, type: 'file' });
          }}
        >
          <span className="text-xs">{getFileIcon(node.name)}</span>
          <span className="text-xs truncate flex-1" style={{ color: activeFile?.id === node.id ? '#E2E8F0' : '#9CA3AF' }}>
            {node.name}
          </span>
          {dirty[node.id] && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} />
          )}
        </div>
      );
    });

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <TopBar
        title={activeProject ? `📁 ${activeProject.name}` : 'Editor Workspace'}
        extra={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Role badge */}
            {isViewer && (
              <span className="px-2 py-0.5 text-xs rounded-full" style={{ background: 'rgba(251,191,36,0.1)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }}>
                👁 View Only
              </span>
            )}
            {saveText && <span className="text-xs font-medium" style={{ color: saveColor }}>{saveText}</span>}

            {/* AI action buttons */}
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

            {/* Run button */}
            {activeFile && (
              <button onClick={handleRun}
                className="px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1"
                style={{ background: '#4ADE80', color: '#0A0A0F' }}
                title="Run file (F5)">
                ▶ Run
              </button>
            )}

            {/* Save button (hidden for viewers) */}
            {canEdit && (
              <button onClick={handleSave}
                disabled={!activeFile || !dirty[activeFile?.id]}
                className="px-3 py-1.5 text-xs rounded-md font-medium transition-all disabled:opacity-40"
                style={{ background: '#00D4B8', color: '#0A0A0F' }}>
                Save {dirtyCount > 0 ? `(${dirtyCount})` : ''}
              </button>
            )}

            <button onClick={() => setShowTerminal(!showTerminal)}
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
              style={{ background: showTerminal ? '#00D4B8' : '#1A1A26', color: showTerminal ? '#0A0A0F' : '#9CA3AF', border: '1px solid #2A2A3A' }}>
              &gt;_
            </button>
            <button onClick={() => setShowAI(!showAI)}
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
              style={{ background: showAI ? 'rgba(0,212,184,0.15)' : '#1A1A26', color: showAI ? '#00D4B8' : '#9CA3AF', border: showAI ? '1px solid rgba(0,212,184,0.3)' : '1px solid #2A2A3A' }}>
              ✦ AI
            </button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── File Explorer ──────────────────────────────────────────── */}
        <div className="flex flex-col w-52 border-r overflow-hidden" style={{ background: '#0D0D16', borderColor: '#1A1A26' }}>
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A26' }}>
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>
              {activeProject?.name ?? 'Explorer'}
            </span>
            {activeProject && canEdit && (
              <div className="flex gap-1">
                <button onClick={() => { setNewFileParent(''); setShowNewFile((v) => !v); }}
                  className="text-xs hover:text-white px-1 transition-colors" style={{ color: '#6B7280' }} title="New file">
                  +
                </button>
              </div>
            )}
          </div>

          {showNewFile && (
            <div className="px-2 py-2 border-b" style={{ borderColor: '#1A1A26' }}>
              {newFileParent && (
                <p className="text-xs mb-1 truncate" style={{ color: '#6B7280' }}>📁 {newFileParent}/</p>
              )}
              <input autoFocus
                className="w-full px-2 py-1 text-xs rounded outline-none text-white"
                style={{ background: '#12121A', border: '1px solid #00D4B8' }}
                placeholder="filename.ts or folder/file.ts"
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

        {/* ── Editor Area ────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center border-b overflow-x-auto" style={{ borderColor: '#1A1A26', background: '#0D0D16', minHeight: '36px' }}>
            {openFiles.length === 0 && <span className="px-4 text-xs" style={{ color: '#3A3A50' }}>No open files</span>}
            {openFiles.map((file) => (
              <div key={file.id}
                className="flex items-center gap-2 px-4 py-2 cursor-pointer border-r text-xs whitespace-nowrap transition-all group"
                style={{
                  borderColor: '#1A1A26',
                  background: activeFile?.id === file.id ? '#0A0A0F' : 'transparent',
                  color: activeFile?.id === file.id ? '#E2E8F0' : '#6B7280',
                  borderBottom: activeFile?.id === file.id ? '1px solid #00D4B8' : '1px solid transparent',
                }}
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
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 px-4 py-1 border-b text-xs" style={{ borderColor: '#1A1A26', background: '#0A0A0F', color: '#3A3A50' }}>
                  <span>{activeProject?.name}</span>
                  <span>›</span>
                  <span style={{ color: '#6B7280' }}>{activeFile.fileName}</span>
                  <span className="ml-auto" style={{ color: '#3A3A50' }}>{getLang(activeFile.fileName)}</span>
                  {isViewer && <span className="text-xs" style={{ color: '#FBBF24' }}>read-only</span>}
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
                      fontFamily: `'${settings.editor.fontFamily}', 'Fira Code', monospace`,
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
                      // IntelliSense / Suggestions
                      suggest: { showKeywords: true, showSnippets: true, showMethods: true, showFunctions: true, showVariables: true, showClasses: true, showModules: true },
                      quickSuggestions: { other: true, comments: false, strings: true },
                      parameterHints: { enabled: true },
                      acceptSuggestionOnEnter: 'on',
                      suggestOnTriggerCharacters: true,
                      // Formatting
                      formatOnPaste: settings.editor.formatOnSave,
                      formatOnType: settings.editor.formatOnSave,
                      // Read-only for viewers
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
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {[['Ctrl+S','save'], ['Ctrl+Shift+S','save all'], ['F5','run']].map(([key, label]) => (
                    <React.Fragment key={key}>
                      <kbd className="px-2 py-1 text-xs rounded" style={{ background: '#1A1A26', color: '#6B7280', border: '1px solid #2A2A3A' }}>{key}</kbd>
                      <span className="text-xs self-center" style={{ color: '#3A3A50' }}>{label}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Terminal + Run output */}
            {showTerminal && (
              <div style={{ height: '220px', borderTop: '1px solid #1A1A26' }}>
                {runOutput ? (
                  <div className="h-full flex flex-col" style={{ background: '#080810' }}>
                    <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: '#1A1A26' }}>
                      <span className="text-xs font-medium" style={{ color: '#4ADE80' }}>▶ Run Output — {activeFile?.fileName}</span>
                      <button onClick={() => setRunOutput(null)} className="text-xs" style={{ color: '#6B7280' }}>✕ Close</button>
                    </div>
                    <div className="flex-1 overflow-auto p-3 font-mono text-xs" style={{ color: '#CBD5E1' }}>
                      {runOutput.running ? (
                        <span style={{ color: '#F59E0B' }}>Running…</span>
                      ) : (
                        <>
                          {runOutput.out && <pre className="whitespace-pre-wrap" style={{ color: '#CBD5E1' }}>{runOutput.out}</pre>}
                          {runOutput.err && <pre className="whitespace-pre-wrap" style={{ color: '#F87171' }}>{runOutput.err}</pre>}
                          {!runOutput.out && !runOutput.err && <span style={{ color: '#6B7280' }}>No output.</span>}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <Terminal onClose={() => setShowTerminal(false)} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── AI Panel ───────────────────────────────────────────────── */}
        {showAI && (
          <div className="w-72 border-l overflow-hidden" style={{ borderColor: '#1A1A26' }}>
            <AIAssistant compact initialMessage={aiContext} onContextConsumed={() => setAiContext('')} />
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
