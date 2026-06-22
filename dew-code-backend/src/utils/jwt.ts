import jwt, { SignOptions } from 'jsonwebtoken';
import { Response } from 'express';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// ── Token Generation ─────────────────────────────────────────────────────
// expiresIn must be typed through SignOptions to satisfy @types/jsonwebtoken

export const generateAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, process.env.JWT_SECRET as string, options);
};

export const generateRefreshToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, options);
};

// ── Token Verification ───────────────────────────────────────────────────

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as JwtPayload;
};

// ── Cookie Helpers ───────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === 'production';

export const setTokenCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  // Frontend (Vercel) and backend (Render) live on different domains in
  // production, so this is a cross-site request from the browser's point
  // of view. SameSite=Strict (and even Lax) would silently stop the
  // browser from sending these cookies back at all. Cross-site cookies
  // require SameSite=None + Secure — both only safe/required once we're
  // actually on HTTPS, i.e. in production.
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
};

export const clearTokenCookies = (res: Response): void => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
};