import React from 'react';
import TopBar from '../components/layout/TopBar';
import AIAssistant from '../components/ai/AIAssistant';

const AIPage: React.FC = () => (
  <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
    <TopBar />
    <div className="flex-1 overflow-hidden p-6">
      <div className="mb-4 animate-fade-in">
        <h2 className="text-xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>AI Assistant</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Powered by Ollama Qwen2.5-Coder — zero API cost, runs locally</p>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1A1A26', height: 'calc(100vh - 160px)' }}>
        <AIAssistant />
      </div>
    </div>
  </div>
);

export default AIPage;
