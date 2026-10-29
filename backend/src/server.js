import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for mobile apps & web
app.use(cors());
app.use(express.json());

// Database initialization middleware for serverless/local
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
    } catch (err) {
      console.error('Database connection error:', err);
    }
  }
  next();
});

// Health Check API
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: '🙏 Radhe Radhe! Bhakti App Backend API is running smoothly.',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Initialize DB and start server (Only in local standalone environment)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  async function startServer() {
    await initDb();
    dbInitialized = true;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Bhakti App Backend running on: http://localhost:${PORT}`);
      console.log(`📱 Local Network Access: http://127.0.0.1:${PORT}`);
    });
  }
  startServer();
}

export default app;
