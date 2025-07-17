// utils/sendFileToTelegram.js
import FormData from 'form-data';

export default async function sendFileToTelegram({ botUrl, chatId, json, filename, caption }) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append(
    'document',
    Buffer.from(JSON.stringify(json, null, 2), 'utf-8'),
    {
      filename,
      contentType: 'application/json'
    }
  );
  if (caption) form.append('caption', caption);

  const tgRes = await fetch(`${botUrl}/sendDocument`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });
  return tgRes;
}
