// Matt Bot — Node.js Backend
// Requires: npm install express cors dotenv @anthropic-ai/sdk fs

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*' // Lock this down to your domain in production
}));
app.use(express.json());

// ── Anthropic client ──────────────────────────────────────────────────────────

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ── Load system prompt once at startup ───────────────────────────────────────

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, 'system-prompt.txt'),
  'utf-8'
);

// ── Chat endpoint ─────────────────────────────────────────────────────────────
// Accepts:
//   { message: string, history: [{ role: 'user'|'assistant', content: string }] }
// Returns:
//   { reply: string }

app.post('/chat', async (req, res) => {
  try {

    const message = req.body.message;

    if (!message) {
      return res.status(400).json({
        error: 'Message required'
      });
    }

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    });

    const reply = response.content[0].text;

    res.json({ reply });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Matt Bot server running on port ${PORT}`);
});
