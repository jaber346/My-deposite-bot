const config = require("../config");

module.exports = {
  name: "kick",
  category: "Group",
  description: "Supprimer un membre du groupe",

  async execute(sock, m, args, { isGroup } = {}) {
    const from = m.key.remoteJid;

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Cette commande fonctionne uniquement en groupe." }, { quoted: m });
    }

    const meta = await sock.groupMetadata(from);
    const participants = meta.participants || [];

    const senderId = m.key.participant || m.sender;

    // Vérifie admin (user)
    const isSenderAdmin = participants.find(p => p.id === senderId)?.admin;
    if (!isSenderAdmin) {
      return sock.sendMessage(from, { text: "🚫 Seuls les admins peuvent utiliser cette commande." }, { quoted: m });
    }

    // Vérifie admin (bot)
    const botId = sock.user.id.includes(":")
      ? sock.user.id.split(":")[0] + "@s.whatsapp.net"
      : sock.user.id;

    // 1) Cible via reply
    const q = m.message?.extendedTextMessage?.contextInfo;
    let target =
      q?.participant ||
      q?.quotedMessage?.sender ||
      null;

    // 2) Cible via mention
    const mentioned = q?.mentionedJid?.[0];
    if (!target && mentioned) target = mentioned;

    // 3) Cible via numéro
    if (!target && args[0]) {
      const num = String(args[0]).replace(/[^0-9]/g, "");
      if (num.length >= 6) target = num + "@s.whatsapp.net";
    }

    if (!target) {
      return sock.sendMessage(from, {
        text: "⚠️ Utilisation :\n.kick (en répondant à un membre)\n.kick 226xxxxxxxx\n.kick @226xxxxxxxx",
      }, { quoted: m });
    }

    // Empêcher kick bot / admins
    const isTargetAdmin = participants.find(p => p.id === target)?.admin;
    if (isTargetAdmin) {
      return sock.sendMessage(from, { text: "⚠️ Impossible : la cible est admin." }, { quoted: m });
    }
    if (target === botId) {
      return sock.sendMessage(from, { text: "😅 Je ne peux pas me kick moi-même." }, { quoted: m });
    }

    try {
      await sock.groupParticipantsUpdate(from, [target], "remove");
      return sock.sendMessage(from, {
        text: `✅ Membre supprimé : @${target.split("@")[0]}`,
        mentions: [target],
      }, { quoted: m });
    } catch (e) {
      return sock.sendMessage(from, { text: "❌ Échec du kick (droits insuffisants ou erreur WhatsApp)." }, { quoted: m });
    }
  }
};