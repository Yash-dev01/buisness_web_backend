import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'
import { initDatabase, getDbStatus } from './db.js';
import { apiRouter } from './routes.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SELF_URL =
  process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

function startKeepAlive() {
  setInterval(async () => {
    try {
      const response = await fetch(`${SELF_URL}/api/categories`);

      console.log(
        `[Keep Alive] ${new Date().toISOString()} - /api/categories - ${response.status}`
      );
    } catch (error) {
      console.error('[Keep Alive] Failed:', error);
    }
  }, 10 * 60 * 1000);
}
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      'https://khilonapointandcyclestoreofficial.netlify.app'
    ],
    credentials: true,
  })
);

// Increase payload limit for Cloudinary image uploads
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Mount API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Khilona Point API',
    database: getDbStatus(),
    timestamp: new Date().toISOString(),
  });
});

async function start() {
  try {
    await initDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(
        `Khilona Point API running on http://localhost:${PORT}`
      );
      startKeepAlive();
    });
  } catch (err) {
    console.error('Fatal server boot error:', err);
    process.exit(1);
  }
}

start();