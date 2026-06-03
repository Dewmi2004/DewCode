import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchFiles,
  setActiveFile,
  closeFile,
  createFile,
  updateFile,
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
  rs: 'rust', go: 'go', java: 'java', txt: 'plaintext',
};

const getLang = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'plaintext';
};

const EditorPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { activeProject, files, openFiles, activeFile, filesLoading } = useAppSelector((s) => s.projects);
  const [showTerminal, setShowTerminal] = useState(true);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);

  // Fetch files when active project changes
  useEffect(() => {
    if (activeProject) {
      dispatch(fetchFiles(activeProject.id));
    }
  }, [activeProject?.id, dispatch]);

  // Convert ProjectFile[] to FileNode[] for the existing FileTree component
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
  };

  const handleEditorChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      dispatch(patchFileContent({ id: activeFile.id, content: value }));
    }
  };

  const handleSave = () => {
    if (activeFile) {
      dispatch(updateFile({ id: activeFile.id, data: { content: activeFile.content } }));
    }
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

  // Ctrl+S to save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeFile]);

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <TopBar title="Editor Workspace" extra={
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
            style={{ background: '#00D4B8', color: '#0A0A0F' }}
          >
            Save
          </button>
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
            style={{ background: showTerminal ? '#00D4B8' : '#1A1A26', color: showTerminal ? '#0A0A0F' : '#9CA3AF', border: '1px solid #2A2A3A' }}
          >
            Terminal
          </button>
        </div>
      } />

      <div className="flex flex-1 overflow-hidden">
        {/* Explorer */}
        <div className="flex flex-col w-52 border-r overflow-hidden" style={{ background: '#0D0D16', borderColor: '#1A1A26' }}>
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A26' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: '#6B7280' }}>📂</span>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>
                {activeProject?.name ?? 'Explorer'}
              </span>
            </div>
            {activeProject && (
              <button
                onClick={() => setShowNewFile((v) => !v)}
                className="text-xs hover:text-white transition-colors"
                style={{ color: '#6B7280' }}
                title="New file"
              >
                +
              </button>
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
            </div>
          )}

          <div className="flex-1 overflow-auto py-2">
            {filesLoading ? (
              <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>Loading files…</p>
            ) : activeProject ? (
              fileNodes.length > 0 ? (
                <FileTree
                  nodes={fileNodes}
                  onFileSelect={handleFileSelect}
                  selectedId={activeFile?.id}
                />
              ) : (
                <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>No files yet. Press + to create one.</p>
              )
            ) : (
              <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>No project selected</p>
            )}
          </div>
        </div>

        {/* Main editor area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center border-b overflow-x-auto" style={{ borderColor: '#1A1A26', background: '#0D0D16', minHeight: '36px' }}>
            {openFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-4 py-2 cursor-pointer border-r text-xs whitespace-nowrap transition-all"
                style={{
                  borderColor: '#1A1A26',
                  background: activeFile?.id === file.id ? '#0A0A0F' : 'transparent',
                  color: activeFile?.id === file.id ? '#E2E8F0' : '#6B7280',
                  borderBottom: activeFile?.id === file.id ? '1px solid #00D4B8' : '1px solid transparent',
                }}
                onClick={() => dispatch(setActiveFile(file))}
              >
                <span>{file.fileName}</span>
                <button
                  onClick={(e) => handleCloseTab(file.id, e)}
                  className="w-4 h-4 rounded hover:bg-gray-700 flex items-center justify-center text-xs"
                  style={{ color: '#6B7280' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeFile ? (
              <div className="flex-1" style={{ minHeight: 0 }}>
                <Editor
                  height="100%"
                  language={getLang(activeFile.fileName)}
                  value={activeFile.content}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
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
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center" style={{ color: '#3A3A50' }}>
                <p className="text-2xl mb-2">{'</>'}</p>
                <p className="text-sm">No file opened</p>
                <p className="text-xs mt-1">Select a file from the explorer or press + to create one</p>
              </div>
            )}

            {showTerminal && (
              <div style={{ height: '220px', borderTop: '1px solid #1A1A26' }}>
                <Terminal onClose={() => setShowTerminal(false)} />
              </div>
            )}
          </div>
        </div>

        {/* AI Panel */}
        <div className="w-72 border-l overflow-hidden" style={{ borderColor: '#1A1A26' }}>
          <AIAssistant compact />
        </div>
      </div>
    </div>
  );
};

export default EditorPage;