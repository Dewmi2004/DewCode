import 'dotenv/config';
import http from 'http';
import app from './app';
import connectDB from './config/database';
import { initCollaborationSocket } from './sockets/collaboration.socket';
import { initChatSocket } from './sockets/chat.socket';
import { setIO } from './sockets/io';

const PORT = parseInt(process.env.PORT || '5000', 10);

const startServer = async (): Promise<void> => {
  await connectDB();

  const httpServer = http.createServer(app);
  const io = initCollaborationSocket(httpServer);
  initChatSocket(io);
  setIO(io);

  const server = httpServer.listen(PORT, () => {
    console.log(`🚀  DewCode API running on http://localhost:${PORT}`);
    console.log(`📌  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌  Real-time collaboration + chat WebSocket ready`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('✅  HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('❌  Unhandled Rejection:', reason);
    server.close(() => process.exit(1));
  });
};

startServer();