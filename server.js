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

const SYSTEM_PROMPT_BASE = fs.readFileSync(
  path.join(__dirname, 'system-prompt.txt'),
  'utf-8'
);

// Inject today's date at request time so Claude always knows the real date
function buildSystemPrompt() {
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return `Today's date is ${today}.\n\n${SYSTEM_PROMPT_BASE}`;
}

// ── Chat endpoint ─────────────────────────────────────────────────────────────
// Accepts:
//   { message: string, history: [{ role: 'user'|'assistant', content: string }] }
// Returns:
//   { reply: string }

app.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  // Build the messages array from history + new user message
  const messages = [
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: message.trim() }
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages
    });

    let reply = response.content[0].text;
    let plannerData = null;

    // Extract and strip the hidden PLANNER_DATA block if present
    const plannerMatch = reply.match(/PLANNER_DATA:(\{[\s\S]+?\})\s*$/m);
    if (plannerMatch) {
      try {
        plannerData = JSON.parse(plannerMatch[1]);
      } catch (e) {
        console.warn('Could not parse PLANNER_DATA:', e.message);
      }
      reply = reply.replace(/\n?PLANNER_DATA:\{[\s\S]+?\}\s*$/m, '').trim();
    }

    res.json({ reply, plannerData });

  } catch (err) {
    console.error('Anthropic API error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
