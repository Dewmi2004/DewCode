import React, { useState } from 'react';
import { FileNode } from '../../types';

interface FileTreeProps {
  nodes: FileNode[];
  onFileSelect: (file: FileNode) => void;
  selectedId?: string;
  depth?: number;
}

const fileIcon = (name: string, type: string) => {
  if (type === 'folder') return null;
  const ext = name.split('.').pop()?.toLowerCase();
  const icons: Record<string, string> = {
    jsx: '⚛', tsx: '⚛', js: '📜', ts: '📘', py: '🐍', json: '{}', md: '📝',
    html: '🌐', css: '🎨', txt: '📄', rs: '🦀', go: '🐹',
  };
  return icons[ext || ''] || '📄';
};

const FileTree: React.FC<FileTreeProps> = ({ nodes, onFileSelect, selectedId, depth = 0 }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ src: true, components: true });

  return (
    <div>
      {nodes.map(node => (
        <div key={node.id}>
          <div
            className={`file-tree-item flex items-center gap-1.5 ${node.type === 'file' && selectedId === node.id ? 'selected' : ''}`}
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            onClick={() => {
              if (node.type === 'folder') {
                setExpanded(e => ({ ...e, [node.id]: !e[node.id] }));
              } else {
                onFileSelect(node);
              }
            }}
          >
            {node.type === 'folder' ? (
              <>
                <span className="text-xs" style={{ color: '#6B7280' }}>{expanded[node.id] ? '▼' : '▶'}</span>
                <span className="text-xs" style={{ color: '#9CA3AF' }}>📂</span>
              </>
            ) : (
              <>
                <span className="w-3" />
                <span className="text-xs">{fileIcon(node.name, node.type)}</span>
              </>
            )}
            <span className="text-xs truncate" style={{ color: node.type === 'folder' ? '#9CA3AF' : '#CBD5E1' }}>
              {node.name}
            </span>
          </div>
          {node.type === 'folder' && expanded[node.id] && node.children && (
            <FileTree
              nodes={node.children}
              onFileSelect={onFileSelect}
              selectedId={selectedId}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default FileTree;
