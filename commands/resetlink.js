// commands/resetlink.js
const config = require("../config");

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
  name: "resetlink",
  category: "Group",
  description: "Réinitialiser le lien du groupe",

  async execute(sock, m, args, { isGroup } = {}) {
    const from = m.key.remoteJid;
    const sender = normJid(m.key.participant || m.sender || "");
    const botJid = normJid(sock.user.id);

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Groupe uniquement." }, { quoted: m });
    }

    const meta = await sock.groupMetadata(from);

    // sender doit être admin
    if (!isAdmin(meta, sender)) {
      return sock.sendMessage(
        from,
        { text: "🚫 Seuls les *admins* peuvent utiliser *resetlink*.", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    try {
      // revoke old invite => new invite
      await sock.groupRevokeInvite(from);
      const code = await sock.groupInviteCode(from);
      const link = `https://chat.whatsapp.com/${code}`;

      return sock.sendMessage(
        from,
        {
          text:
`✅ *Lien réinitialisé avec succès !*

🔗 Nouveau lien :
${link}`,
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: "❌ Impossible de réinitialiser le lien (WhatsApp a refusé).", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }
  }
};