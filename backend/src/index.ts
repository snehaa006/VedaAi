import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import { initWebSocket } from './services/websocket';
import { startWorker } from './services/queue';
import assignmentRoutes from './routes/assignments';

const app = express();
const server = createServer(app);
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3002',
]);

// Middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));

// Routes
app.use('/api/assignments', assignmentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Init WebSocket
initWebSocket(server);

// Connect to MongoDB and start
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vedaai';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    startWorker();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    // Start server anyway (for development without MongoDB)
    startWorker();
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (without DB)`);
    });
  });

export default app;
