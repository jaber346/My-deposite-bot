// commands/mute.js
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
  name: "mute",
  category: "Group",
  description: "Met le groupe en mode muet (seuls les admins parlent)",

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
      // ✅ "announcement" = seuls les admins peuvent envoyer des messages
      await sock.groupSettingUpdate(from, "announcement");

      return sock.sendMessage(from, {
        text: `🔇 *GROUPE MUET ACTIVÉ*\nSeuls les admins peuvent écrire.\n\n✅ Désactiver : *${prefix || "."}unmute*`
      }, { quoted: m });
    } catch (e) {
      return sock.sendMessage(from, { text: "❌ Impossible de mute (erreur WhatsApp / droits insuffisants)." }, { quoted: m });
    }
  }
};