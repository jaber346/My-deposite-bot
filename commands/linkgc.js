// commands/linkgc.js
const config = require("../config");

// enlève :device
function normJid(jid = "") {
  jid = String(jid || "");
  if (!jid) return jid;
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function isAdmin(meta, jid) {
  const n = normJid(jid);
  const p = (meta.participants || []).find(x => normJid(x.id) === n);
  return Boolean(p?.admin);
}

function newsletterCtx() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363423249667073@newsletter",
      newsletterName: config.BOT_NAME || "NOVA XMD V1",
      serverMessageId: 1
    }
  };
}

module.exports = {
  name: "linkgc",
  category: "Group",
  description: "Afficher le lien du groupe + infos",

  async execute(sock, m, args, { isGroup } = {}) {
    const from = m.key.remoteJid;
    const sender = normJid(m.key.participant || m.sender || "");

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Groupe uniquement." }, { quoted: m });
    }

    const meta = await sock.groupMetadata(from);
    const botJid = normJid(sock.user.id);

    // sender doit être admin (tu peux enlever ça si tu veux)
    if (!isAdmin(meta, sender)) {
      return sock.sendMessage(
        from,
        { text: "🚫 Seuls les *admins* peuvent utiliser *linkgc*.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    const participants = meta.participants || [];
    const admins = participants.filter(p => p.admin).map(p => p.id);

    let inviteCode = "";
    try {
      inviteCode = await sock.groupInviteCode(from);
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: "❌ Impossible d’obtenir le lien (WhatsApp a refusé).", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    const link = `https://chat.whatsapp.com/${inviteCode}`;

    const text =
`╭━━〔 🔗 LINKGC • ${config.BOT_NAME || "NOVA XMD V1"} 〕━━╮
┃ 🏷️ Groupe   : ${meta.subject || "Groupe"}
┃ 👥 Membres  : ${participants.length}
┃ 🛡️ Admins   : ${admins.length}
┃ 🆔 ID       : ${from}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

🔗 Lien :
${link}

💡 Astuce : envoie *resetlink* pour régénérer le lien (si tu l’ajoutes).`;

    return sock.sendMessage(from, { text, contextInfo: newsletterCtx() }, { quoted: m });
  }
};