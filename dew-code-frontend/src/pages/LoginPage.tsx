import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

const LoginPage: React.FC = () => {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await new Promise(r => setTimeout(r, 600));
    const ok = login(email, password);
    if (!ok) setError('Invalid credentials. Try demo@dewcode.dev');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#0A0A0F' }}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #00D4B8, transparent)', top: '10%', left: '10%', filter: 'blur(60px)' }} />
        <div className="absolute w-96 h-96 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #00D4B8, transparent)', bottom: '10%', right: '10%', filter: 'blur(80px)' }} />
        {/* Grid */}
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00D4B8" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="w-full max-w-md px-8 py-10 animate-fade-in relative z-10"
        style={{ background: 'rgba(18,18,26,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,212,184,0.15)', borderRadius: '16px' }}>
        
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            <span style={{ color: '#00D4B8' }}>Dew</span><span className="text-white">Code</span>
          </h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>Sign in to your developer workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9CA3AF' }}>Email</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>✉</span>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-md outline-none transition-all"
                style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }}
                onFocus={e => e.target.style.borderColor = '#00D4B8'}
                onBlur={e => e.target.style.borderColor = '#2A2A3A'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9CA3AF' }}>Password</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>🔒</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-md outline-none transition-all"
                style={{ background: '#0A0A0F', border: '1px solid #2A2A3A', color: '#E2E8F0' }}
                onFocus={e => e.target.style.borderColor = '#00D4B8'}
                onBlur={e => e.target.style.borderColor = '#2A2A3A'}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded" style={{ color: '#F87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-2.5 text-sm font-semibold" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="relative flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: '#2A2A3A' }} />
            <span className="text-xs" style={{ color: '#6B7280' }}>OR CONTINUE WITH</span>
            <div className="flex-1 h-px" style={{ background: '#2A2A3A' }} />
          </div>

          <button type="button"
            className="w-full py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2"
            style={{ background: '#1A1A26', border: '1px solid #2A2A3A', color: '#E2E8F0' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#00D4B8')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2A3A')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign in with Google
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: '#6B7280' }}>
          Don't have an account?{' '}
          <span className="cursor-pointer font-medium" style={{ color: '#00D4B8' }}>Sign up</span>
        </p>

        <p className="text-center text-xs mt-3" style={{ color: '#3A3A50' }}>
          Demo: demo@dewcode.dev / any password
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
