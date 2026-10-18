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

// Initialize DB and start server
async function startServer() {
  await initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bhakti App Backend running on: http://localhost:${PORT}`);
    console.log(`📱 Local Network Access: http://127.0.0.1:${PORT}`);
  });
}

startServer();
