const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

function getQuoted(m) {
  return m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

function unwrapViewOnce(msg) {
  if (!msg) return null;

  if (msg.viewOnceMessage?.message)
    return msg.viewOnceMessage.message;

  if (msg.viewOnceMessageV2?.message)
    return msg.viewOnceMessageV2.message;

  if (msg.viewOnceMessageV2Extension?.message)
    return msg.viewOnceMessageV2Extension.message;

  return null;
}

module.exports = {
  name: "vv",
  category: "Tools",
  description: "Voir une image/vidéo view-once",

  async execute(sock, m) {
    const from = m.key.remoteJid;

    const quoted = getQuoted(m);
    if (!quoted) {
      return sock.sendMessage(from, {
        text: "⚠️ Réponds à une image/vidéo view-once avec *.vv*"
      }, { quoted: m });
    }

    try {
      const innerMsg = unwrapViewOnce(quoted);

      if (!innerMsg) {
        return sock.sendMessage(from, {
          text: "❌ Ce message n’est pas un view-once valide."
        }, { quoted: m });
      }

      let type = null;
      let media = null;

      if (innerMsg.imageMessage) {
        type = "image";
        media = innerMsg.imageMessage;
      } else if (innerMsg.videoMessage) {
        type = "video";
        media = innerMsg.videoMessage;
      } else {
        return sock.sendMessage(from, {
          text: "❌ Type non supporté."
        }, { quoted: m });
      }

      const stream = await downloadContentFromMessage(media, type);
      const buffer = await streamToBuffer(stream);

      if (type === "image") {
        await sock.sendMessage(from, {
          image: buffer,
          caption: "👁️ View Once récupérée"
        }, { quoted: m });
      } else {
        await sock.sendMessage(from, {
          video: buffer,
          caption: "👁️ View Once récupérée"
        }, { quoted: m });
      }

    } catch (e) {
      console.log("VV ERROR:", e);
      return sock.sendMessage(from, {
        text: "❌ Erreur récupération view-once."
      }, { quoted: m });
    }
  }
};