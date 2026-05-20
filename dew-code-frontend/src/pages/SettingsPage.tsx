import React, { useState } from 'react';
import TopBar from '../components/layout/TopBar';
import { useApp } from '../context/AppContext';

const SettingsPage: React.FC = () => {
  const { user } = useApp();
  const [tab, setTab] = useState('profile');
  const [theme, setTheme] = useState('dark');
  const [aiModel, setAiModel] = useState('qwen2.5-coder');
  const [fontSize, setFontSize] = useState('13');

  const tabs = ['profile', 'editor', 'ai', 'github', 'security'];

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <TopBar />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 animate-fade-in">
          <h2 className="text-xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Settings</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage your account and preferences</p>
        </div>

        <div className="flex gap-6">
          <div className="w-40 space-y-0.5">
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`sidebar-item w-full text-left px-3 py-2 text-sm rounded-md capitalize ${tab === t ? 'active' : 'text-gray-400'}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 max-w-xl animate-fade-in">
            {tab === 'profile' && (
              <div className="card p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white mb-4">Profile Settings</h3>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                    style={{ background: 'rgba(0,212,184,0.15)', color: '#00D4B8', border: '2px solid rgba(0,212,184,0.3)' }}>
                    {user?.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{user?.name}</p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>{user?.email}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
                      style={{ background: 'rgba(0,212,184,0.1)', color: '#00D4B8', border: '1px solid rgba(0,212,184,0.2)' }}>
                      {user?.role}
                    </span>
                  </div>
                </div>
                {[{ label: 'Display Name', val: user?.name || '' }, { label: 'Email', val: user?.email || '' }].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>{f.label}</label>
                    <input defaultValue={f.val} className="w-full px-3 py-2 text-sm rounded-md outline-none"
                      style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }} />
                  </div>
                ))}
                <button className="btn-primary px-4 py-2 text-sm mt-2">Save Changes</button>
              </div>
            )}

            {tab === 'editor' && (
              <div className="card p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white mb-4">Editor Preferences</h3>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Theme</label>
                  <select value={theme} onChange={e => setTheme(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md outline-none"
                    style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }}>
                    <option value="dark">VS Dark (Default)</option>
                    <option value="light">VS Light</option>
                    <option value="hc-black">High Contrast</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Font Size</label>
                  <input type="number" value={fontSize} onChange={e => setFontSize(e.target.value)}
                    min="10" max="24"
                    className="w-full px-3 py-2 text-sm rounded-md outline-none"
                    style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }} />
                </div>
                {['Word Wrap', 'Minimap', 'Line Numbers', 'Auto-save'].map(opt => (
                  <div key={opt} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: '#CBD5E1' }}>{opt}</span>
                    <div className="w-10 h-5 rounded-full cursor-pointer relative" style={{ background: '#00D4B8' }}>
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-black" />
                    </div>
                  </div>
                ))}
                <button className="btn-primary px-4 py-2 text-sm">Save Preferences</button>
              </div>
            )}

            {tab === 'ai' && (
              <div className="card p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white mb-4">AI Configuration</h3>
                <div className="px-3 py-2 rounded-md text-xs" style={{ background: 'rgba(0,212,184,0.05)', border: '1px solid rgba(0,212,184,0.15)', color: '#6B7280' }}>
                  ✦ Running locally via Ollama — no API costs
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>AI Model</label>
                  <select value={aiModel} onChange={e => setAiModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md outline-none"
                    style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }}>
                    <option value="qwen2.5-coder">Qwen2.5-Coder (Recommended)</option>
                    <option value="codellama">CodeLlama 7B</option>
                    <option value="deepseek-coder">DeepSeek Coder</option>
                    <option value="starcoder">StarCoder 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Ollama Endpoint</label>
                  <input defaultValue="http://localhost:11434" className="w-full px-3 py-2 text-sm rounded-md outline-none"
                    style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }} />
                </div>
                <button className="btn-primary px-4 py-2 text-sm">Save AI Settings</button>
              </div>
            )}

            {tab === 'github' && (
              <div className="card p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white mb-4">GitHub Integration</h3>
                <div className="px-3 py-2 rounded-md text-xs" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', color: '#F87171' }}>
                  Not connected to GitHub
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Personal Access Token</label>
                  <input type="password" placeholder="ghp_xxxxxxxxxxxx" className="w-full px-3 py-2 text-sm rounded-md outline-none"
                    style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Default Branch</label>
                  <input defaultValue="main" className="w-full px-3 py-2 text-sm rounded-md outline-none"
                    style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }} />
                </div>
                <button className="btn-primary px-4 py-2 text-sm">Connect GitHub</button>
              </div>
            )}

            {tab === 'security' && (
              <div className="card p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white mb-4">Security Settings</h3>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Current Password</label>
                  <input type="password" className="w-full px-3 py-2 text-sm rounded-md outline-none"
                    style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>New Password</label>
                  <input type="password" className="w-full px-3 py-2 text-sm rounded-md outline-none"
                    style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#CBD5E1' }}>Two-Factor Authentication</span>
                  <div className="w-10 h-5 rounded-full cursor-pointer relative" style={{ background: '#2A2A3A' }}>
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-gray-500" />
                  </div>
                </div>
                <button className="btn-primary px-4 py-2 text-sm">Update Password</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
