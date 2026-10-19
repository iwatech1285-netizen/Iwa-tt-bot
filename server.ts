import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './apps/api/src/routes/apiRoutes.ts';
import { standardRateLimiter } from './apps/api/src/middleware/rateLimiter.ts';
import { bot, startBotPolling } from './apps/bot/src/bot.ts';
import { webhookCallback } from 'grammy';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Basic security & parsing
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(standardRateLimiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'IWA BOT API',
  });
});

// Telegram Bot Webhook endpoint (if webhook configured)
if (bot && process.env.TELEGRAM_WEBHOOK_SECRET) {
  app.use(
    '/api/telegram/webhook',
    webhookCallback(bot, 'express', {
      secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    })
  );
}

// REST API routes
app.use('/api', apiRouter);

// Start Telegram Bot polling in dev or non-webhook mode
if (bot && !process.env.TELEGRAM_WEBHOOK_SECRET) {
  startBotPolling();
}

async function startServer() {
  if (!isProduction) {
    // Mount Vite in middleware mode for hot development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 IWA BOT Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
