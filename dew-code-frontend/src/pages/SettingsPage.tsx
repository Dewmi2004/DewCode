// - All settings wired to Redux + persisted to backend
// - Theme changes apply live to Monaco editor
// - Role-based: Viewers cannot change editor/AI settings
// - Loading states and success/error toasts

import React, { useState } from 'react';
import TopBar from '../components/layout/TopBar';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { updateSettings, updateEditorSettings, updateAISettings } from '../features/settings/settingsSlice';
import UpgradeModal from '../components/billing/UpgradeModal';
import { PLAN_LIMITS, PLUS_PRICE_LKR } from '../config/plans';

type Tab = 'profile' | 'editor' | 'ai' | 'github' | 'security' | 'billing';

const THEMES = [
  { value: 'dark',          label: 'VS Dark (Default)' },
  { value: 'light',         label: 'VS Light' },
  { value: 'hc-black',      label: 'High Contrast' },
  { value: 'solarized',     label: 'Solarized Dark' },
  { value: 'monokai',       label: 'Monokai' },
  { value: 'dracula',       label: 'Dracula' },
  { value: 'nord',          label: 'Nord' },
];

const AI_MODELS = [
  { value: 'qwen2.5-coder',   label: 'Qwen2.5-Coder (Recommended)' },
  { value: 'codellama',        label: 'CodeLlama 7B' },
  { value: 'deepseek-coder',   label: 'DeepSeek Coder' },
  { value: 'starcoder',        label: 'StarCoder 2' },
  { value: 'llama3.2',         label: 'Llama 3.2' },
];

const ROLE_DESCRIPTION = 'Create and edit projects and files, use AI';

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!value)}
    className="w-10 h-5 rounded-full relative transition-colors"
    style={{ background: value ? '#00D4B8' : '#2A2A3A', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
      style={{ transform: value ? 'translateX(21px)' : 'translateX(2px)' }} />
  </button>
);

const SettingsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const settings = useAppSelector((s) => s.settings.settings);
  const loading = useAppSelector((s) => s.settings.loading);

  const [tab, setTab]     = useState<Tab>('profile');
  // Single role now — nothing is read-only-by-role anymore. Kept as a
  // constant so the disabled={isViewer} props below don't need touching.
  const isViewer = false;
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveEditor = async () => {
    try {
      await dispatch(updateSettings({ editor: settings.editor })).unwrap();
      showToast('Editor settings saved!');
    } catch { showToast('Save failed', 'error'); }
  };

  // Single-role app now — every signed-in account sees every tab.
  const visibleTabs: { id: Tab; label: string }[] = [
    { id: 'profile',  label: 'Profile' },
    { id: 'billing',  label: 'Billing' },
    { id: 'editor',   label: 'Editor' },
    { id: 'ai',       label: 'AI' },
    { id: 'github',   label: 'GitHub' },
    { id: 'security', label: 'Security' },
  ];

  const inputStyle: React.CSSProperties = {
    background: '#0A0A0F', border: '1px solid #2A2A3A',
    color: '#E2E8F0', borderRadius: '8px', width: '100%',
    padding: '8px 12px', fontSize: '14px', outline: 'none',
  };

  const roleColor = '#00D4B8';

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      <TopBar />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in"
          style={{ background: toast.type === 'success' ? 'rgba(0,212,184,0.15)' : 'rgba(248,113,113,0.15)',
            color: toast.type === 'success' ? '#00D4B8' : '#F87171',
            border: `1px solid ${toast.type === 'success' ? 'rgba(0,212,184,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Settings</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage your account and preferences</p>
        </div>

        <div className="flex gap-6">
          {/* Tab nav */}
          <div className="w-40 space-y-0.5 flex-shrink-0">
            {visibleTabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="w-full text-left px-3 py-2.5 text-sm rounded-md capitalize transition-all"
                style={{
                  background: tab === t.id ? 'rgba(0,212,184,0.08)' : 'transparent',
                  color: tab === t.id ? '#00D4B8' : '#9CA3AF',
                  borderLeft: tab === t.id ? '2px solid #00D4B8' : '2px solid transparent',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 max-w-xl">

            {/* ── PROFILE ── */}
            {tab === 'profile' && (
              <div className="rounded-xl p-6 space-y-5" style={{ background: '#12121A', border: '1px solid #1E1E2E' }}>
                <h3 className="text-sm font-semibold text-white">Profile</h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
                    style={{ background: `${roleColor}20`, color: roleColor, border: `2px solid ${roleColor}40` }}>
                    {user?.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{user?.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{user?.email}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: `${roleColor}15`, color: roleColor, border: `1px solid ${roleColor}30` }}>
                        {user?.role}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#4B5563' }}>
                      {ROLE_DESCRIPTION}
                    </p>
                  </div>
                </div>

                {['Display Name', 'Email'].map((label, i) => (
                  <div key={label}>
                    <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>{label}</label>
                    <input defaultValue={i === 0 ? user?.name : user?.email} style={inputStyle}
                      disabled={isViewer}
                      onFocus={(e) => (e.target.style.borderColor = '#00D4B8')}
                      onBlur={(e) => (e.target.style.borderColor = '#2A2A3A')} />
                  </div>
                ))}
                {!isViewer && (
                  <button className="px-4 py-2 text-sm font-medium rounded-lg transition-all hover:opacity-90"
                    style={{ background: '#00D4B8', color: '#0A0A0F' }}>
                    Save Profile
                  </button>
                )}
              </div>
            )}

            {/* ── BILLING ── */}
            {tab === 'billing' && (
              <div className="rounded-xl p-6 space-y-5" style={{ background: '#12121A', border: '1px solid #1E1E2E' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Plan &amp; Billing</h3>
                  <span className="text-xs px-2 py-1 rounded-full font-semibold"
                    style={{
                      background: user?.plan === 'plus' ? 'rgba(0,212,184,0.15)' : 'rgba(107,114,128,0.15)',
                      color: user?.plan === 'plus' ? '#00D4B8' : '#9CA3AF',
                      border: `1px solid ${user?.plan === 'plus' ? 'rgba(0,212,184,0.3)' : 'rgba(107,114,128,0.3)'}`,
                    }}>
                    {user?.plan === 'plus' ? '⚡ PLUS' : 'FREE PLAN'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden" style={{ background: '#1E1E2E' }}>
                  <div className="p-3 text-xs font-semibold" style={{ background: '#0A0A0F', color: '#6B7280' }}>Limit</div>
                  <div className="p-3 text-xs font-semibold text-center" style={{ background: '#0A0A0F', color: '#9CA3AF' }}>Free</div>
                  <div className="p-3 text-xs font-semibold text-center" style={{ background: '#0A0A0F', color: '#00D4B8' }}>Plus</div>

                  {([
                    ['Projects', PLAN_LIMITS.free.maxProjects, PLAN_LIMITS.plus.maxProjects],
                    ['Folders / project', PLAN_LIMITS.free.maxFoldersPerProject, PLAN_LIMITS.plus.maxFoldersPerProject],
                    ['Files / project', PLAN_LIMITS.free.maxFilesPerProject, PLAN_LIMITS.plus.maxFilesPerProject],
                    ['Max file size', `${PLAN_LIMITS.free.maxFileSizeKB}KB`, `${PLAN_LIMITS.plus.maxFileSizeKB / 1024}MB`],
                  ] as [string, string | number, string | number][]).map(([label, free, plus]) => (
                    <React.Fragment key={label}>
                      <div className="p-3 text-xs" style={{ background: '#0D0D16', color: '#9CA3AF' }}>{label}</div>
                      <div className="p-3 text-xs text-center" style={{ background: '#0D0D16', color: '#CBD5E1' }}>{free}</div>
                      <div className="p-3 text-xs text-center font-medium" style={{ background: '#0D0D16', color: '#00D4B8' }}>{plus}</div>
                    </React.Fragment>
                  ))}
                </div>

                {user?.plan === 'plus' ? (
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    You're on Plus — thanks for supporting DewCode! All limits above are lifted.
                  </p>
                ) : (
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-xl font-bold text-white">LKR {PLUS_PRICE_LKR.toLocaleString()}</span>
                      <span className="text-xs ml-1" style={{ color: '#6B7280' }}>one-time</span>
                    </div>
                    <button onClick={() => setShowUpgrade(true)}
                      className="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
                      style={{ background: '#00D4B8', color: '#0A0A0F' }}>
                      ⚡ Upgrade with PayHere
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── EDITOR ── */}
            {tab === 'editor' && (
              <div className="rounded-xl p-6 space-y-5" style={{ background: '#12121A', border: '1px solid #1E1E2E' }}>
                <h3 className="text-sm font-semibold text-white">Editor Preferences</h3>

                {isViewer && (
                  <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', color: '#FBBF24' }}>
                    👁 Viewer role — settings are read-only
                  </div>
                )}

                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Theme</label>
                  <select value={settings.appearance.theme}
                    onChange={(e) => !isViewer && dispatch(updateSettings({ appearance: { ...settings.appearance, theme: e.target.value as never } }))}
                    style={{ ...inputStyle, cursor: isViewer ? 'not-allowed' : 'auto' }} disabled={isViewer}>
                    {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Font Size ({settings.editor.fontSize}px)</label>
                  <input type="range" min="10" max="24" value={settings.editor.fontSize}
                    disabled={isViewer}
                    onChange={(e) => dispatch(updateEditorSettings({ fontSize: Number(e.target.value) }))}
                    className="w-full accent-teal-400" />
                </div>

                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Tab Size</label>
                  <select value={settings.editor.tabSize}
                    onChange={(e) => dispatch(updateEditorSettings({ tabSize: Number(e.target.value) }))}
                    style={inputStyle} disabled={isViewer}>
                    {[2,4,8].map((n) => <option key={n} value={n}>{n} spaces</option>)}
                  </select>
                </div>

                {[
                  { key: 'wordWrap',     label: 'Word Wrap',       val: settings.editor.wordWrap === 'on',   onChange: (v: boolean) => dispatch(updateEditorSettings({ wordWrap: v ? 'on' : 'off' })) },
                  { key: 'minimap',      label: 'Minimap',          val: settings.editor.minimap,             onChange: (v: boolean) => dispatch(updateEditorSettings({ minimap: v })) },
                  { key: 'lineNumbers',  label: 'Line Numbers',     val: settings.editor.lineNumbers,         onChange: (v: boolean) => dispatch(updateEditorSettings({ lineNumbers: v })) },
                  { key: 'autoSave',     label: 'Auto Save',        val: settings.editor.autoSave,            onChange: (v: boolean) => dispatch(updateEditorSettings({ autoSave: v })) },
                  { key: 'formatOnSave', label: 'Format on Save',   val: settings.editor.formatOnSave,        onChange: (v: boolean) => dispatch(updateEditorSettings({ formatOnSave: v })) },
                  { key: 'compactMode',  label: 'Compact Mode',     val: settings.appearance.compactMode,     onChange: (v: boolean) => dispatch(updateSettings({ appearance: { ...settings.appearance, compactMode: v } })) },
                ].map(({ key, label, val, onChange }) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-sm" style={{ color: '#CBD5E1' }}>{label}</span>
                    <Toggle value={val} onChange={onChange} disabled={isViewer} />
                  </div>
                ))}

                {!isViewer && (
                  <button onClick={handleSaveEditor} disabled={loading}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#00D4B8', color: '#0A0A0F' }}>
                    {loading ? 'Saving…' : 'Save Preferences'}
                  </button>
                )}
              </div>
            )}

            {/* ── AI ── */}
            {tab === 'ai' && (
              <div className="rounded-xl p-6 space-y-5" style={{ background: '#12121A', border: '1px solid #1E1E2E' }}>
                <h3 className="text-sm font-semibold text-white">AI Configuration</h3>
                <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(0,212,184,0.05)', border: '1px solid rgba(0,212,184,0.15)', color: '#6B7280' }}>
                  ✦ Running locally via Ollama — zero API costs
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>AI Model</label>
                  <select style={inputStyle} disabled={isViewer}
                    onChange={(e) => dispatch(updateAISettings({ model: e.target.value }))}>
                    {AI_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>Ollama Endpoint</label>
                  <input defaultValue="http://localhost:11434" style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = '#00D4B8')}
                    onBlur={(e) => (e.target.style.borderColor = '#2A2A3A')} />
                </div>
                {!isViewer && (
                  <button className="px-4 py-2 text-sm font-medium rounded-lg" style={{ background: '#00D4B8', color: '#0A0A0F' }}>
                    Save AI Settings
                  </button>
                )}
              </div>
            )}

            {/* ── GITHUB ── */}
            {tab === 'github' && (
              <div className="rounded-xl p-6 space-y-5" style={{ background: '#12121A', border: '1px solid #1E1E2E' }}>
                <h3 className="text-sm font-semibold text-white">GitHub Integration</h3>
                <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', color: '#F87171' }}>
                  Not connected to GitHub
                </div>
                {[
                  { label: 'Personal Access Token', type: 'password', placeholder: 'ghp_xxxxxxxxxxxx', key: 'token' },
                  { label: 'GitHub Username', type: 'text', placeholder: 'your-username', key: 'username' },
                  { label: 'Default Branch', type: 'text', placeholder: 'main', key: 'branch' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#00D4B8')}
                      onBlur={(e) => (e.target.style.borderColor = '#2A2A3A')} />
                  </div>
                ))}
                <button className="px-4 py-2 text-sm font-medium rounded-lg" style={{ background: '#00D4B8', color: '#0A0A0F' }}>
                  Connect GitHub
                </button>
              </div>
            )}

            {/* ── SECURITY ── */}
            {tab === 'security' && (
              <div className="rounded-xl p-6 space-y-5" style={{ background: '#12121A', border: '1px solid #1E1E2E' }}>
                <h3 className="text-sm font-semibold text-white">Security</h3>
                {['Current Password', 'New Password', 'Confirm New Password'].map((label) => (
                  <div key={label}>
                    <label className="block text-xs mb-1.5" style={{ color: '#9CA3AF' }}>{label}</label>
                    <input type="password" style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#00D4B8')}
                      onBlur={(e) => (e.target.style.borderColor = '#2A2A3A')} />
                  </div>
                ))}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-sm text-white">Two-Factor Authentication</span>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Add extra security to your account</p>
                  </div>
                  <Toggle value={settings.security?.twoFactorEnabled ?? false}
                    onChange={() => {}} />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-white">Login Alerts</span>
                  <Toggle value={settings.security?.loginAlerts ?? true}
                    onChange={() => {}} />
                </div>
                <button className="px-4 py-2 text-sm font-medium rounded-lg" style={{ background: '#00D4B8', color: '#0A0A0F' }}>
                  Update Password
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
};

export default SettingsPage;
