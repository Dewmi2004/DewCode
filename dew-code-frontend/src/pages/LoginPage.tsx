// src/pages/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

type Tab = 'login' | 'signup';

const LoginPage: React.FC = () => {
  const { login, register, authError, clearAuthError, authLoading } = useApp();
  const [tab, setTab] = useState<Tab>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupError, setSignupError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    clearAuthError();
    setLoginError('');
    setSignupError('');
  }, [tab, clearAuthError]);

  // ── Password strength indicator ────────────────────────────────────────
  const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
    if (!pw) return { label: '', color: '#2A2A3A', width: '0%' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[@$!%*?&]/.test(pw)) score++;
    if (pw.length >= 12) score++;
    if (score <= 1) return { label: 'Weak', color: '#F87171', width: '25%' };
    if (score <= 2) return { label: 'Fair', color: '#FBBF24', width: '50%' };
    if (score <= 3) return { label: 'Good', color: '#34D399', width: '75%' };
    return { label: 'Strong', color: '#00D4B8', width: '100%' };
  };

  const strength = getPasswordStrength(signupPassword);

  // ── Submit handlers ────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter your email and password.');
      return;
    }
    try {
      await login(loginEmail, loginPassword);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    if (!signupName || !signupEmail || !signupPassword || !signupConfirm) {
      setSignupError('All fields are required.');
      return;
    }
    if (signupPassword !== signupConfirm) {
      setSignupError('Passwords do not match.');
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }
    try {
      await register(signupName, signupEmail, signupPassword);
    } catch (err: unknown) {
      setSignupError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#0A0A0F',
    border: '1px solid #2A2A3A',
    color: '#E2E8F0',
    width: '100%',
    padding: '10px 12px 10px 36px',
    fontSize: '14px',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#0A0A0F' }}>

      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #00D4B8, transparent)', top: '10%', left: '10%', filter: 'blur(60px)' }} />
        <div className="absolute w-96 h-96 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #6366F1, transparent)', bottom: '10%', right: '10%', filter: 'blur(80px)' }} />
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00D4B8" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="w-full max-w-md px-8 py-8 relative z-10"
        style={{ background: 'rgba(18,18,26,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,212,184,0.15)', borderRadius: '16px' }}>

        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            <span style={{ color: '#00D4B8' }}>Dew</span><span className="text-white">Code</span>
          </h1>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            {tab === 'login' ? 'Sign in to your developer workspace' : 'Create your developer account'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 rounded-lg overflow-hidden" style={{ background: '#12121A', border: '1px solid #1A1A26' }}>
          {(['login', 'signup'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-sm font-medium transition-all"
              style={{
                background: tab === t ? 'rgba(0,212,184,0.15)' : 'transparent',
                color: tab === t ? '#00D4B8' : '#6B7280',
                borderBottom: tab === t ? '2px solid #00D4B8' : '2px solid transparent',
              }}>
              {t === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* ── LOGIN FORM ─────────────────────────────────────────────── */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9CA3AF' }}>Email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>✉</span>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@example.com" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#00D4B8')}
                  onBlur={e => (e.target.style.borderColor = '#2A2A3A')} />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9CA3AF' }}>Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>🔒</span>
                <input type={showPassword ? 'text' : 'password'} value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: '36px' }}
                  onFocus={e => (e.target.style.borderColor = '#00D4B8')}
                  onBlur={e => (e.target.style.borderColor = '#2A2A3A')} />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: '#6B7280' }}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {(loginError || authError) && (
              <p className="text-xs px-3 py-2 rounded" style={{ color: '#F87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
                {loginError || authError}
              </p>
            )}

            <button type="submit" disabled={authLoading}
              className="w-full py-2.5 text-sm font-semibold rounded-lg transition-all"
              style={{ background: authLoading ? '#1A4A44' : 'rgba(0,212,184,0.15)', color: '#00D4B8', border: '1px solid rgba(0,212,184,0.4)' }}>
              {authLoading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>
        )}

        {/* ── SIGN UP FORM ───────────────────────────────────────────── */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9CA3AF' }}>Full Name</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>👤</span>
                <input type="text" value={signupName} onChange={e => setSignupName(e.target.value)}
                  placeholder="John Doe" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#00D4B8')}
                  onBlur={e => (e.target.style.borderColor = '#2A2A3A')} />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9CA3AF' }}>Email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>✉</span>
                <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                  placeholder="you@example.com" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#00D4B8')}
                  onBlur={e => (e.target.style.borderColor = '#2A2A3A')} />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9CA3AF' }}>Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>🔒</span>
                <input type={showPassword ? 'text' : 'password'} value={signupPassword}
                  onChange={e => setSignupPassword(e.target.value)} placeholder="Min. 8 chars, uppercase, number, symbol"
                  style={{ ...inputStyle, paddingRight: '36px' }}
                  onFocus={e => (e.target.style.borderColor = '#00D4B8')}
                  onBlur={e => (e.target.style.borderColor = '#2A2A3A')} />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: '#6B7280' }}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {/* Password strength bar */}
              {signupPassword && (
                <div className="mt-1.5">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: '#2A2A3A' }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: strength.width, background: strength.color }} />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: '#9CA3AF' }}>Confirm Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#6B7280' }}>🔒</span>
                <input type={showPassword ? 'text' : 'password'} value={signupConfirm}
                  onChange={e => setSignupConfirm(e.target.value)} placeholder="Repeat password"
                  style={{ ...inputStyle, borderColor: signupConfirm && signupConfirm !== signupPassword ? '#F87171' : '#2A2A3A' }}
                  onFocus={e => (e.target.style.borderColor = '#00D4B8')}
                  onBlur={e => (e.target.style.borderColor = signupConfirm && signupConfirm !== signupPassword ? '#F87171' : '#2A2A3A')} />
              </div>
              {signupConfirm && signupConfirm !== signupPassword && (
                <p className="text-xs mt-0.5" style={{ color: '#F87171' }}>Passwords don't match</p>
              )}
            </div>

            {(signupError || authError) && (
              <p className="text-xs px-3 py-2 rounded" style={{ color: '#F87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
                {signupError || authError}
              </p>
            )}

            <button type="submit" disabled={authLoading}
              className="w-full py-2.5 text-sm font-semibold rounded-lg transition-all"
              style={{ background: authLoading ? '#1A4A44' : 'rgba(0,212,184,0.15)', color: '#00D4B8', border: '1px solid rgba(0,212,184,0.4)' }}>
              {authLoading ? 'Creating account…' : 'Create Account →'}
            </button>

            <p className="text-xs text-center" style={{ color: '#4B5563' }}>
              By signing up you agree to our Terms of Service
            </p>
          </form>
        )}

        {/* Switch tab link */}
        <p className="text-center text-xs mt-5" style={{ color: '#6B7280' }}>
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span onClick={() => setTab(tab === 'login' ? 'signup' : 'login')}
            className="cursor-pointer font-medium transition-colors"
            style={{ color: '#00D4B8' }}>
            {tab === 'login' ? 'Sign up' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;