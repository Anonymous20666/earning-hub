import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize GoogleGenAI server-side with User-Agent header as required
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Chat API endpoint (multi-turn streaming via Server-Sent Events)
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userRole, userName } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    const contents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(m.content || m.text || '') }],
    }));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.write(`data: ${JSON.stringify({ text: "Hello! I am Pappy AI. I'm currently running in demo mode. Please configure the GEMINI_API_KEY environment variable in settings to enable live Gemini AI generation." })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    const systemInstruction = `You are Pappy AI, the intelligent virtual assistant for Pappy Earning Hub.
Pappy Earning Hub is an automated WhatsApp and Telegram traffic distribution and earning ecosystem.
Key platform facts:
- New worker registration grants a locked 200.000 Coin / NGN bonus.
- Workers require >= 300.000 Coins in earned balance for their first payout/withdrawal.
- Coin formula for WhatsApp Groups: 1X mode pays Math.min(members, 1000) / 1000 Coins; 2X VIP pays 2 * Math.min(members, 1000) / 1000 Coins. Locked groups (announce-only) and groups with < 100 members pay 0 Coins.
- Advertisers can launch direct WhatsApp sessions or smart verified broadcasts with country targeting (Nigeria +234, Ghana +233, Kenya +254, US +1, etc.).
- There is an automated JID ledger, pairing QR system, live terminal logs, and anti-spam verification.
- Current user: ${userName || 'Valued User'} (Role: ${userRole || 'EARNER'}).
Be concise, friendly, helpful, professional, and knowledgeable about the platform. Use markdown formatting where helpful.`;

    let responseStream;
    let attempts = 0;
    while (attempts < 2) {
      try {
        attempts++;
        responseStream = await ai.models.generateContentStream({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
        break;
      } catch (retryErr: any) {
        if (attempts >= 2) throw retryErr;
        await new Promise(r => setTimeout(r, 600));
      }
    }

    if (responseStream) {
      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    let friendly = 'Gemini AI is momentarily experiencing high demand. Please try asking again in a few moments.';
    if (typeof error?.message === 'string' && !error.message.includes('503')) {
      friendly = error.message;
    }
    res.write(`data: ${JSON.stringify({ text: `\n\n*Notice: ${friendly}*` })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await fs.promises.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
