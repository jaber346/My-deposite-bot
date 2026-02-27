// commands/unmute.js
const config = require("../config");

function normJid(jid = "") {
  jid = String(jid || "");
  if (!jid) return "";
  if (jid.includes("@")) {
    const [left, right] = jid.split("@");
    const cleanLeft = left.includes(":") ? left.split(":")[0] : left;
    return cleanLeft + "@" + right;
  }
  return jid;
}

module.exports = {
  name: "unmute",
  category: "Group",
  description: "Réactive le chat (tout le monde peut parler)",

  async execute(sock, m, args, extra = {}) {
    const { isGroup, prefix } = extra;
    const from = m.key.remoteJid;

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Cette commande fonctionne uniquement en groupe." }, { quoted: m });
    }

    const meta = await sock.groupMetadata(from);
    const participants = meta.participants || [];

    const sender = normJid(m.key.participant || m.participant || m.sender || "");
    const senderIsAdmin = !!participants.find(p => normJid(p.id) === sender)?.admin;

    if (!senderIsAdmin) {
      return sock.sendMessage(from, { text: "🚫 Seuls les admins peuvent utiliser cette commande." }, { quoted: m });
    }

    const botId = normJid(sock.user?.id || "");
    const botIsAdmin = !!participants.find(p => normJid(p.id) === botId)?.admin;

    try {
      // ✅ "not_announcement" = tout le monde peut envoyer des messages
      await sock.groupSettingUpdate(from, "not_announcement");

      return sock.sendMessage(from, {
        text: `🔊 *GROUPE OUVERT*\nTout le monde peut écrire.\n\n✅ Remettre muet : *${prefix || "."}mute*`
      }, { quoted: m });
    } catch (e) {
      return sock.sendMessage(from, { text: "❌ Impossible de unmute (erreur WhatsApp / droits insuffisants)." }, { quoted: m });
    }
  }
};