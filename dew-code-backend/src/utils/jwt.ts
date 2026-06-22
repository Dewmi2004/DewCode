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
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
};

export const clearTokenCookies = (res: Response): void => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
};