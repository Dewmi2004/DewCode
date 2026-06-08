// ✅ Code Suggestions Component
// Displays inline code suggestions/completions with descriptions

import React from 'react';
import { CodeSuggestion } from '../../types';

interface CodeSuggestionsProps {
  suggestions: CodeSuggestion[];
  onSelectSuggestion?: (suggestion: CodeSuggestion) => void;
  loading?: boolean;
}

const CodeSuggestions: React.FC<CodeSuggestionsProps> = ({
  suggestions,
  onSelectSuggestion,
  loading,
}) => {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">💡</span>
        <h3 className="text-sm font-semibold text-gray-100">Suggestions</h3>
      </div>

      {loading && (
        <div className="flex items-center space-x-2 text-gray-400">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Getting suggestions...</span>
        </div>
      )}

      {/* Suggestions List */}
      {!loading && (
        <div className="space-y-2">
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              onClick={() => onSelectSuggestion?.(suggestion)}
              className="p-3 bg-blue-500/5 border border-blue-500/30 rounded cursor-pointer hover:bg-blue-500/10 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <code className="text-xs font-mono text-blue-400 block truncate">
                    {suggestion.text}
                  </code>
                  <p className="text-xs text-gray-400 mt-1">{suggestion.description}</p>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-blue-600 text-white text-xs rounded whitespace-nowrap ml-2 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSuggestion?.(suggestion);
                  }}
                >
                  Use
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CodeSuggestions;
