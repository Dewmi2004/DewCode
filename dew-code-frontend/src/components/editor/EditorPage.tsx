import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useApp } from '../../context/AppContext';
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
  const { activeProject, openFiles, setOpenFiles, activeFile, setActiveFile } = useApp();
  const [showTerminal, setShowTerminal] = useState(true);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});

  const openFile = (file: FileNode) => {
    if (!openFiles.find(f => f.id === file.id)) {
      setOpenFiles([...openFiles, file]);
    }
    setActiveFile(file);
  };

  const closeTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newOpen = openFiles.filter(f => f.id !== fileId);
    setOpenFiles(newOpen);
    if (activeFile?.id === fileId) {
      setActiveFile(newOpen[newOpen.length - 1] || null);
    }
  };

  const getCurrentContent = () => {
    if (!activeFile) return '';
    return fileContents[activeFile.id] ?? activeFile.content ?? '';
  };

  const handleEditorChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      setFileContents(c => ({ ...c, [activeFile.id]: value }));
    }
  };

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <TopBar title="Editor Workspace" extra={
        <div className="flex gap-2">
          <button onClick={() => setShowTerminal(!showTerminal)}
            className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
            style={{ background: showTerminal ? '#00D4B8' : '#1A1A26', color: showTerminal ? '#0A0A0F' : '#9CA3AF', border: '1px solid #2A2A3A' }}>
            Terminal
          </button>
          <button className="px-3 py-1.5 text-xs rounded-md transition-all"
            style={{ background: '#1A1A26', color: '#9CA3AF', border: '1px solid #2A2A3A' }}>
            ⊞
          </button>
        </div>
      } />

      <div className="flex flex-1 overflow-hidden">
        {/* Explorer */}
        <div className="flex flex-col w-52 border-r overflow-hidden" style={{ background: '#0D0D16', borderColor: '#1A1A26' }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: '#1A1A26' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: '#6B7280' }}>📂</span>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6B7280' }}>Explorer</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto py-2">
            {activeProject ? (
              <FileTree
                nodes={activeProject.files}
                onFileSelect={openFile}
                selectedId={activeFile?.id}
              />
            ) : (
              <p className="text-xs px-4 py-2" style={{ color: '#6B7280' }}>No project selected</p>
            )}
          </div>
        </div>

        {/* Main editor area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center border-b overflow-x-auto" style={{ borderColor: '#1A1A26', background: '#0D0D16', minHeight: '36px' }}>
            {openFiles.map(file => (
              <div key={file.id}
                className="flex items-center gap-2 px-4 py-2 cursor-pointer border-r text-xs whitespace-nowrap transition-all"
                style={{
                  borderColor: '#1A1A26',
                  background: activeFile?.id === file.id ? '#0A0A0F' : 'transparent',
                  color: activeFile?.id === file.id ? '#E2E8F0' : '#6B7280',
                  borderBottom: activeFile?.id === file.id ? '1px solid #00D4B8' : '1px solid transparent',
                }}
                onClick={() => setActiveFile(file)}>
                <span>{file.name}</span>
                <button onClick={e => closeTab(file.id, e)}
                  className="w-4 h-4 rounded hover:bg-gray-700 flex items-center justify-center text-xs"
                  style={{ color: '#6B7280' }}>✕</button>
              </div>
            ))}
          </div>

          {/* Editor / no file */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeFile ? (
              <div className="flex-1" style={{ minHeight: 0 }}>
                <Editor
                  height="100%"
                  language={getLang(activeFile.name)}
                  value={getCurrentContent()}
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
                <p className="text-xs mt-1">Select a file from the explorer to start coding</p>
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

        {/* AI Panel */}
        <div className="w-72 border-l overflow-hidden" style={{ borderColor: '#1A1A26' }}>
          <AIAssistant compact />
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
