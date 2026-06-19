// ✅ Code Corrections Panel Component
// Displays code issues, corrections, and suggestions with ability to apply fixes

import React, { useState } from 'react';
import { CodeCorrection, CodeIssue } from '../../types';

interface CodeCorrectionsProps {
  correction: CodeCorrection | null;
  onApplyCorrectedCode?: (code: string) => void;
  loading?: boolean;
}

const CodeCorrections: React.FC<CodeCorrectionsProps> = ({
  correction,
  onApplyCorrectedCode,
  loading,
}) => {
  const [expandedIssues, setExpandedIssues] = useState<string[]>([]);

  const toggleIssue = (index: number) => {
    const key = `issue-${index}`;
    setExpandedIssues((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const getIssueColor = (type: CodeIssue['type']) => {
    switch (type) {
      case 'error':
        return 'border-l-red-500 bg-red-500/10';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-500/10';
      case 'suggestion':
        return 'border-l-blue-500 bg-blue-500/10';
      default:
        return 'border-l-gray-500 bg-gray-500/10';
    }
  };

  const getIssueIcon = (type: CodeIssue['type']) => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'suggestion':
        return '💡';
      default:
        return 'ℹ️';
    }
  };

  // ✅ FIXED: this used to be `if (!correction) return null;`, which meant
  // the whole panel — including its "Analyzing code..." spinner — never
  // rendered during the Ollama round-trip, since `correction` stays null
  // until a response arrives. Only bail when there's nothing to show at all.
  if (!correction && !loading) {
    return null;
  }

  const hasIssues = !!correction?.issues && correction.issues.length > 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-100">Code Corrections</h3>
        {hasIssues && (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
            {correction!.issues.length} issue{correction!.issues.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center space-x-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Analyzing code...</span>
        </div>
      )}

      {!loading && correction && !hasIssues && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-xs">
          ✅ No issues found! Your code looks good.
        </div>
      )}

      {/* Issues List */}
      {!loading && hasIssues && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {correction!.issues.map((issue, idx) => (
            <div
              key={idx}
              className={`border-l-4 rounded p-3 cursor-pointer transition-colors ${getIssueColor(
                issue.type
              )}`}
              onClick={() => toggleIssue(idx)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="mt-0.5">{getIssueIcon(issue.type)}</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-100">
                      {issue.type.toUpperCase()}
                      {issue.line && ` at line ${issue.line}`}
                    </div>
                    <div className="text-xs text-gray-300 mt-1">{issue.message}</div>
                  </div>
                </div>
              </div>

              {/* Issue Details */}
              {expandedIssues.includes(`issue-${idx}`) && issue.fix && (
                <div className="mt-2 pt-2 border-t border-black/20">
                  <div className="text-xs text-gray-400 mb-1">Suggested fix:</div>
                  <code className="text-xs bg-black/30 p-2 rounded block font-mono text-gray-300">
                    {issue.fix}
                  </code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Corrected Code Preview */}
      {!loading && correction?.correctedCode && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-300">Corrected Code:</div>
          <div className="bg-black/30 p-3 rounded max-h-40 overflow-y-auto">
            <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-words">
              {correction.correctedCode}
            </pre>
          </div>
        </div>
      )}

      {/* Explanation */}
      {!loading && correction?.explanation && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-300">Explanation:</div>
          <div className="text-xs text-gray-400 bg-black/20 p-3 rounded">
            {correction.explanation}
          </div>
        </div>
      )}

      {/* Apply Button */}
      {!loading && correction?.correctedCode && onApplyCorrectedCode && (
        <button
          onClick={() => onApplyCorrectedCode(correction.correctedCode)}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
        >
          Apply Corrections
        </button>
      )}
    </div>
  );
};

export default CodeCorrections;