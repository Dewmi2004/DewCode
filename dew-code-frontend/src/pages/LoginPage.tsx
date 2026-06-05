// src/pages/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { loginUser, registerUser, clearError } from '../store/slices/authSlice';

interface LoginPageProps {
  onBack?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onBack }) => {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    dispatch(clearError());
  }, [isLogin, dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      dispatch(loginUser({ email, password }));
    } else {
      dispatch(registerUser({ name, email, password }));
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#0A0A0F',
    border: '1px solid #1E1E2E',
    borderRadius: '8px',
    color: 'white',
    padding: '10px 14px',
    width: '100%',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0A0A0F' }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{ background: '#12121A', border: '1px solid #1E1E2E' }}
      >
        {onBack && (
          <button
            type="button"
            className="mb-5 text-xs font-medium text-gray-500 transition-colors hover:text-white"
            onClick={onBack}
          >
            Back to website
          </button>
        )}

        {/* Logo */}
        <div className="text-center mb-7">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            <span style={{ color: '#00D4B8' }}>Dew</span>
            <span className="text-white">Code</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Full Name</label>
              <input
                style={inputStyle}
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Email</label>
            <input
              style={inputStyle}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Password</label>
            <div className="relative">
              <input
                style={{ ...inputStyle, paddingRight: '40px' }}
                type={showPass ? 'text' : 'password'}
                placeholder={isLogin ? '••••••••' : 'Min 8 chars, Uppercase, Number, Symbol'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: '#00D4B8', color: '#000' }}
          >
            {loading ? (isLogin ? 'Signing in…' : 'Creating account…') : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p className="text-gray-500 text-sm text-center mt-5">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="font-medium hover:underline"
            style={{ color: '#00D4B8' }}
            onClick={() => setIsLogin((v) => !v)}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
