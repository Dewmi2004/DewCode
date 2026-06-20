// ✅ UPDATED src/app.ts
// Fixed: terminal route import uses lowercase filename (terminal.routes.ts)
// Added: /api/users/settings PATCH route

import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { apiLimiter } from './middleware/rateLimiter.middleware';
import errorHandler from './middleware/error.middleware';
import authRoutes     from './routes/auth.routes';
import userRoutes     from './routes/user.routes';
import projectRoutes  from './routes/project.routes';
import fileRoutes     from './routes/file.routes';
import folderRoutes   from './routes/folder.routes';
import aiRoutes       from './routes/ai.routes';
import terminalRoutes from './routes/terminal.routes';
import paymentRoutes  from './routes/payment.routes';

const app: Application = express();

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      // PayHere's onsite checkout loads its own script and renders the
      // card form inside an iframe it injects — both need to be allowed.
      scriptSrc:  ["'self'", 'https://www.payhere.lk', 'https://sandbox.payhere.lk'],
      frameSrc:   ["'self'", 'https://www.payhere.lk', 'https://sandbox.payhere.lk'],
      connectSrc: ["'self'", 'https://www.payhere.lk', 'https://sandbox.payhere.lk'],
      imgSrc:     ["'self'", 'data:', 'https:'],
    },
  },
}));

app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(mongoSanitize());
app.use('/api', apiLimiter);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files',    fileRoutes);
app.use('/api/folders',  folderRoutes);
app.use('/api/ai',       aiRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/payments', paymentRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use(errorHandler);

export default app;
