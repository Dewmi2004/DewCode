// ✅ Day 5 → CODE EDITOR UI + Day 6 → SAVE & LOAD FILES
// Features: File Explorer (left), Monaco Editor (center), AI Panel (right), Terminal (bottom)

import React, { useEffect, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchFiles,
  setActiveFile,
  closeFile,
  createFile,
  updateFile,
  deleteFile,
  patchFileContent,
} from '../../store/slices/projectSlice';
import { FileNode } from '../../types';
import FileTree from './FileTree';
import Terminal from '../terminal/Terminal';
import AIAssistant from '../ai/AIAssistant';
import TopBar from '../layout/TopBar';

const LANG_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', json: 'json', md: 'markdown', html: 'html', css: 'css',
  scss: 'scss', rs: 'rust', go: 'go', java: 'java', txt: 'plaintext',
  sh: 'shell', yml: 'yaml', yaml: 'yaml', xml: 'xml', sql: 'sql',
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
  };
  return icons[ext] || '📄';
};

// Tracks which files have unsaved changes
type DirtyMap = Record<string, boolean>;

const EditorPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { activeProject, files, openFiles, activeFile, filesLoading } = useAppSelector((s) => s.projects);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showAI, setShowAI] = useState(true);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [dirty, setDirty] = useState<DirtyMap>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fileId: string } | null>(null);
  const [aiContext, setAiContext] = useState<string>('');

  // ── Day 6: Load files when active project changes ─────────────────────
  useEffect(() => {
    if (activeProject) {
      dispatch(fetchFiles(activeProject.id));
    }
  }, [activeProject?.id, dispatch]);

  const fileNodes: FileNode[] = files.map((f) => ({
    id: f.id,
    name: f.fileName,
    type: 'file',
    content: f.content,
    language: f.language,
    path: f.fileName,
  }));

  const handleFileSelect = (node: FileNode) => {
    const file = files.find((f) => f.id === node.id);
    if (file) dispatch(setActiveFile(file));
  };

  const handleCloseTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(closeFile(fileId));
    setDirty((d) => { const next = { ...d }; delete next[fileId]; return next; });
  };

  // ── Day 6: Track unsaved changes ─────────────────────────────────────
  const handleEditorChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      dispatch(patchFileContent({ id: activeFile.id, content: value }));
      setDirty((d) => ({ ...d, [activeFile.id]: true }));
      setSaveStatus('idle');
    }
  };

  // ── Day 6: Save file to backend ───────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!activeFile || !dirty[activeFile.id]) return;
    setSaveStatus('saving');
    try {
      await dispatch(updateFile({ id: activeFile.id, data: { content: activeFile.content } }));
      setDirty((d) => ({ ...d, [activeFile.id]: false }));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [activeFile, dirty, dispatch]);

  const handleSaveAll = async () => {
    const dirtyFiles = openFiles.filter((f) => dirty[f.id]);
    for (const f of dirtyFiles) {
      await dispatch(updateFile({ id: f.id, data: { content: f.content } }));
      setDirty((d) => ({ ...d, [f.id]: false }));
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !activeProject) return;
    await dispatch(createFile({
      fileName: newFileName.trim(),
      content: '',
      projectId: activeProject.id,
    }));
    setNewFileName('');
    setShowNewFile(false);
  };

  const handleDeleteFile = async (fileId: string) => {
    await dispatch(deleteFile(fileId));
    setContextMenu(null);
  };

  // ── Day 11: Send selected code to AI ─────────────────────────────────
  const handleSendToAI = (action: 'explain' | 'fix' | 'generate') => {
    if (!activeFile) return;
    const prompts = {
      explain: `Explain this code:\n\n\`\`\`${getLang(activeFile.fileName)}\n${activeFile.content}\n\`\`\``,
      fix: `Fix any bugs in this code:\n\n\`\`\`${getLang(activeFile.fileName)}\n${activeFile.content}\n\`\`\``,
      generate: `Improve or extend this code:\n\n\`\`\`${getLang(activeFile.fileName)}\n${activeFile.content}\n\`\`\``,
    };
    setAiContext(prompts[action]);
    if (!showAI) setShowAI(true);
  };

  // Ctrl+S / Ctrl+Shift+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        handleSaveAll();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]);

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const saveStatusColor = saveStatus === 'saved' ? '#00D4B8' : saveStatus === 'saving' ? '#F59E0B' : saveStatus === 'error' ? '#F87171' : '#6B7280';
  const saveStatusText = saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '⟳ Saving…' : saveStatus === 'error' ? '✕ Error' : '';

  const dirtyCount = Object.values(dirty).filter(Boolean).length;

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <TopBar
        title={activeProject ? `📁 ${activeProject.name}` : 'Editor Workspace'}
        extra={
          <div className="flex items-center gap-2">
            {/* Save status indicator */}
            {saveStatusText && (
              <span className="text-xs font-medium" style={{ color: saveStatusColor }}>
                {saveStatusText}
              </span>
            )}
            {/* Day 11: AI action buttons */}
            {activeFile && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleSendToAI('explain')}
                  className="px-2 py-1 text-xs rounded transition-all"
                  style={{ background: 'rgba(0,212,184,0.1)', color: '#00D4B8', border: '1px solid rgba(0,212,184,0.3)' }}
                  title="Explain current file with AI"
                >
                  ✦ Explain
                </button>
                <button
                  onClick={() => handleSendToAI('fix')}
                  className="px-2 py-1 text-xs rounded transition-all"
                  style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}
                  title="Fix bugs with AI"
                >
                  🐛 Fix
                </button>
                <button
                  onClick={() => handleSendToAI('generate')}
                  className="px-2 py-1 text-xs rounded transition-all"
                  style={{ background: 'rgba(139,92,246,0.1)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)' }}
                  title="Generate/extend with AI"
                >
                  ⚡ Generate
                </button>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={!activeFile || !dirty[activeFile?.id]}
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-all disabled:opacity-40"
              style={{ background: '#00D4B8', color: '#0A0A0F' }}
            >
              Save {dirtyCount > 0 ? `(${dirtyCount})` : ''}
            </button>
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
              style={{
                background: showTerminal ? '#00D4B8' : '#1A1A26',
                color: showTerminal ? '#0A0A0F' : '#9CA3AF',
                border: '1px solid #2A2A3A',
              }}
            >
              {'>'}_
            </button>
            <button
              onClick={() => setShowAI(!showAI)}
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
              style={{
                background: showAI ? 'rgba(0,212,184,0.15)' : '#1A1A26',
                color: showAI ? '#00D4B8' : '#9CA3AF',
                border: showAI ? '1px solid rgba(0,212,184,0.3)' : '1px solid #2A2A3A',
              }}
            >
              ✦ AI
            </button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── File Explorer ───────────────────────────────────────────────── */}
        <div
          className="flex flex-col w-52 border-r overflow-hidden"
          style={{ background: '#0D0D16', borderColor: '#1A1A26' }}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A26' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: '#6B7280' }}>📂</span>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>
                {activeProject?.name ?? 'Explorer'}
              </span>
            </div>
            {activeProject && (
              <div className="flex gap-1">
                <button
                  onClick={() => setShowNewFile((v) => !v)}
                  className="text-xs hover:text-white transition-colors px-1"
                  style={{ color: '#6B7280' }}
                  title="New file"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* New file input */}
          {showNewFile && (
            <div className="px-2 py-2 border-b" style={{ borderColor: '#1A1A26' }}>
              <input
                autoFocus
                className="w-full px-2 py-1 text-xs rounded outline-none text-white"
                style={{ background: '#12121A', border: '1px solid #00D4B8' }}
                placeholder="filename.ts"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFile();
                  if (e.key === 'Escape') { setShowNewFile(false); setNewFileName(''); }
                }}
              />
              <p className="text-xs mt-1" style={{ color: '#3A3A50' }}>Enter to create · Esc to cancel</p>
            </div>
          )}

          <div className="flex-1 overflow-auto py-2">
            {filesLoading ? (
              <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>Loading files…</p>
            ) : activeProject ? (
              fileNodes.length > 0 ? (
                <div>
                  {fileNodes.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer group transition-colors"
                      style={{
                        background: activeFile?.id === node.id ? 'rgba(0,212,184,0.08)' : 'transparent',
                        borderLeft: activeFile?.id === node.id ? '2px solid #00D4B8' : '2px solid transparent',
                      }}
                      onClick={() => handleFileSelect(node)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, fileId: node.id });
                      }}
                    >
                      <span className="text-xs">{getFileIcon(node.name)}</span>
                      <span className="text-xs truncate flex-1" style={{ color: activeFile?.id === node.id ? '#E2E8F0' : '#9CA3AF' }}>
                        {node.name}
                      </span>
                      {dirty[node.id] && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} title="Unsaved changes" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>No files yet. Press + to create one.</p>
              )
            ) : (
              <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>No project selected</p>
            )}
          </div>

          {/* File count footer */}
          {files.length > 0 && (
            <div className="px-3 py-2 border-t" style={{ borderColor: '#1A1A26' }}>
              <p className="text-xs" style={{ color: '#3A3A50' }}>{files.length} file{files.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>

        {/* ── Main Editor Area ─────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tabs */}
          <div
            className="flex items-center border-b overflow-x-auto"
            style={{ borderColor: '#1A1A26', background: '#0D0D16', minHeight: '36px' }}
          >
            {openFiles.length === 0 && (
              <span className="px-4 text-xs" style={{ color: '#3A3A50' }}>No open files</span>
            )}
            {openFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-4 py-2 cursor-pointer border-r text-xs whitespace-nowrap transition-all group"
                style={{
                  borderColor: '#1A1A26',
                  background: activeFile?.id === file.id ? '#0A0A0F' : 'transparent',
                  color: activeFile?.id === file.id ? '#E2E8F0' : '#6B7280',
                  borderBottom: activeFile?.id === file.id ? '1px solid #00D4B8' : '1px solid transparent',
                }}
                onClick={() => dispatch(setActiveFile(file))}
              >
                <span className="text-xs">{getFileIcon(file.fileName)}</span>
                <span>{file.fileName}</span>
                {dirty[file.id] && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />
                )}
                <button
                  onClick={(e) => handleCloseTab(file.id, e)}
                  className="w-4 h-4 rounded hover:bg-gray-700 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#6B7280' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeFile ? (
              <>
                {/* Breadcrumb */}
                <div
                  className="flex items-center gap-2 px-4 py-1 border-b text-xs"
                  style={{ borderColor: '#1A1A26', background: '#0A0A0F', color: '#3A3A50' }}
                >
                  <span>{activeProject?.name}</span>
                  <span>›</span>
                  <span style={{ color: '#6B7280' }}>{activeFile.fileName}</span>
                  <span className="ml-auto" style={{ color: '#3A3A50' }}>
                    {getLang(activeFile.fileName)}
                  </span>
                </div>

                <div className="flex-1" style={{ minHeight: 0 }}>
                  <Editor
                    height="100%"
                    language={getLang(activeFile.fileName)}
                    value={activeFile.content}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      fontLigatures: true,
                      minimap: { enabled: true },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      renderLineHighlight: 'gutter',
                      cursorBlinking: 'smooth',
                      smoothScrolling: true,
                      padding: { top: 12 },
                      bracketPairColorization: { enabled: true },
                      guides: { bracketPairs: true },
                      suggest: { showKeywords: true, showSnippets: true },
                      quickSuggestions: { other: true, comments: false, strings: false },
                      parameterHints: { enabled: true },
                      formatOnPaste: true,
                      formatOnType: true,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center" style={{ color: '#3A3A50' }}>
                <p className="text-4xl mb-3">{'</>'}</p>
                <p className="text-sm mb-1" style={{ color: '#6B7280' }}>No file opened</p>
                <p className="text-xs">Select a file from the explorer or press + to create one</p>
                <div className="mt-6 flex gap-2">
                  <kbd className="px-2 py-1 text-xs rounded" style={{ background: '#1A1A26', color: '#6B7280', border: '1px solid #2A2A3A' }}>
                    Ctrl+S
                  </kbd>
                  <span className="text-xs self-center" style={{ color: '#3A3A50' }}>to save</span>
                  <kbd className="px-2 py-1 text-xs rounded" style={{ background: '#1A1A26', color: '#6B7280', border: '1px solid #2A2A3A' }}>
                    Ctrl+Shift+S
                  </kbd>
                  <span className="text-xs self-center" style={{ color: '#3A3A50' }}>to save all</span>
                </div>
              </div>
            )}

            {/* Terminal */}
            {showTerminal && (
              <div style={{ height: '220px', borderTop: '1px solid #1A1A26' }}>
                <Terminal onClose={() => setShowTerminal(false)} />
              </div>
            )}
          </div>
        </div>

        {/* ── AI Panel ──────────────────────────────────────────────────────── */}
        {showAI && (
          <div className="w-72 border-l overflow-hidden" style={{ borderColor: '#1A1A26' }}>
            <AIAssistant compact initialMessage={aiContext} onContextConsumed={() => setAiContext('')} />
          </div>
        )}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg shadow-xl overflow-hidden"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#1A1A26',
            border: '1px solid #2A2A3A',
            minWidth: '140px',
          }}
        >
          <button
            className="w-full px-3 py-2 text-xs text-left hover:bg-red-900/20 transition-colors"
            style={{ color: '#F87171' }}
            onClick={() => handleDeleteFile(contextMenu.fileId)}
          >
            🗑 Delete File
          </button>
        </div>
      )}
    </div>
  );
};

export default EditorPage;