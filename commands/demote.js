// commands/demote.js
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

function getTargetsFromMentionsOrReply(m) {
  const ctx = m.message?.extendedTextMessage?.contextInfo;
  const mentioned = ctx?.mentionedJid || [];
  const repliedParticipant = ctx?.participant ? [ctx.participant] : [];
  const targets = [...mentioned, ...repliedParticipant].map(normJid);
  return [...new Set(targets)].filter(Boolean);
}

function isAdmin(meta, jid) {
  const n = normJid(jid);
  const p = (meta.participants || []).find(x => normJid(x.id) === n);
  return Boolean(p?.admin);
}

module.exports = {
  name: "demote",
  category: "Group",
  description: "Retirer les droits admin (tag ou reply)",

  async execute(sock, m, args, { isGroup, prefix } = {}) {
    const from = m.key.remoteJid;
    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Groupe uniquement.", contextInfo: newsletterCtx() }, { quoted: m });
    }

    const meta = await sock.groupMetadata(from);
    const botJid = normJid(sock.user?.id || "");
    const sender = normJid(m.key.participant || m.participant || m.key.remoteJid);

    const botIsAdmin = isAdmin(meta, botJid);
    const senderIsAdmin = isAdmin(meta, sender);

    if (!senderIsAdmin) {
      return sock.sendMessage(from, { text: "🚫 Seuls les *admins* peuvent utiliser demote.", contextInfo: newsletterCtx() }, { quoted: m });
    }

    const targets = getTargetsFromMentionsOrReply(m);
    if (!targets.length) {
      return sock.sendMessage(from, {
        text: `⚠️ Tag un admin ou répond à son message.\nEx: *${prefix || config.PREFIX || "."}demote @226xxxx*`,
        contextInfo: newsletterCtx()
      }, { quoted: m });
    }

    let ok = 0, fail = 0;

    for (const t of targets) {
      try {
        // ignore si pas admin
        if (!isAdmin(meta, t)) continue;
        // évite de demote le bot lui-même
        if (normJid(t) === normJid(botJid)) continue;

        await sock.groupParticipantsUpdate(from, [t], "demote");
        ok++;
      } catch {
        fail++;
      }
    }

    return sock.sendMessage(from, {
      text:
`╭━━〔 ⚠️ DEMOTE • ${config.BOT_NAME || "NOVA XMD V1"} 〕━━╮
┃ 👥 Groupe : ${meta.subject || "Groupe"}
┃ ✅ Succès : ${ok}
┃ ❌ Échecs : ${fail}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      contextInfo: newsletterCtx(),
      mentions: targets
    }, { quoted: m });
  }
};