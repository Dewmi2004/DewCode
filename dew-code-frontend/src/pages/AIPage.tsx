
import React from 'react';
import AIAssistant from '../components/ai/AIAssistant';
import TopBar from '../components/layout/TopBar';

const AIPage: React.FC = () => {
  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <TopBar title="AI Code Assistant" />
      <div className="flex-1 overflow-hidden max-w-3xl w-full mx-auto">
        <AIAssistant />
      </div>
    </div>
  );
};

export default AIPage;