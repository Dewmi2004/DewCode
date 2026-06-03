import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

interface AppError extends Error {
  statusCode?: number;
  code?: number;
  path?: string;
  value?: string;
  errors?: Record<string, { message: string }>;
}

const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose: duplicate key (e.g. email already exists)
  if (err.code === 11000) {
    statusCode = 409;
    message = 'An account with that email already exists.';
  }

  // Mongoose: cast error (invalid ObjectId, etc.)
  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for field: ${err.path}`;
  }

  // Mongoose: validation error
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    const errors: Record<string, string> = {};
    Object.values(err.errors).forEach((e) => {
      errors[e.path] = e.message;
    });
    res.status(statusCode).json({ success: false, message: 'Validation failed', errors });
    return;
  }

  // JWT errors are handled in auth middleware; this catches edge cases
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired.';
  }

  // Never leak stack traces in production
  if (process.env.NODE_ENV === 'production') {
    console.error(`[ERROR] ${err.name}: ${err.message}`);
    if (statusCode === 500) message = 'Something went wrong. Please try again.';
  } else {
    console.error(err);
  }

  res.status(statusCode).json({ success: false, message });
};

export default errorHandler;