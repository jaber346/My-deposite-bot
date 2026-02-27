// commands/kickall.js
const config = require("../config");

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// job store global
global.kickallJobs = global.kickallJobs || new Map();

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

// ✅ NORMALISE JID (enlève :device)
function normJid(jid = "") {
  jid = String(jid || "");
  if (!jid) return jid;
  // "226xxx:12@s.whatsapp.net" -> "226xxx@s.whatsapp.net"
  if (jid.includes(":") && jid.includes("@")) {
    const [left, right] = jid.split("@");
    return left.split(":")[0] + "@" + right;
  }
  return jid;
}

module.exports = {
  name: "kickall",
  category: "Group",
  description: "Purifier le groupe (kick tous les non-admins) avec stop",

  async execute(sock, m, args, { isGroup, isOwner, prefix } = {}) {
    const from = m.key.remoteJid;

    // ✅ sender propre
    const senderRaw =
      m.key.participant ||
      m.participant ||
      m.sender ||
      m.key.remoteJid;

    const sender = normJid(senderRaw);

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Cette commande fonctionne uniquement en groupe." }, { quoted: m });
    }

    // Sécurité: owner seulement
    if (!isOwner) {
      return sock.sendMessage(from, { text: "🚫 Commande réservée au propriétaire." }, { quoted: m });
    }

    // éviter double purge
    if (global.kickallJobs.has(from)) {
      return sock.sendMessage(from, {
        text: `⚠️ Purification déjà en cours.\nEnvoie *${prefix || "."}stop* pour arrêter.`,
        contextInfo: newsletterCtx()
      }, { quoted: m });
    }

    const meta = await sock.groupMetadata(from);
    const participants = meta.participants || [];

    // ✅ bot id propre
    const botId = normJid(sock.user?.id || "");
    const botInGroup = participants.find(p => normJid(p.id) === botId);
    const botIsAdmin = !!botInGroup?.admin;

    // ✅ sender admin check FIX
    const senderInGroup = participants.find(p => normJid(p.id) === sender);
    const senderIsAdmin = !!senderInGroup?.admin;

    if (!senderIsAdmin && !isOwner) {
      // (ici isOwner est déjà required, mais je laisse au cas où tu changes plus tard)
      return sock.sendMessage(from, {
        text: "🚫 Seuls les *admins* peuvent lancer la purification.",
        contextInfo: newsletterCtx()
      }, { quoted: m });
    }

    // créer job
    const job = { stop: false, startedBy: sender };
    global.kickallJobs.set(from, job);

    // message countdown
    await sock.sendMessage(from, {
      text:
`╭━━〔 🧹 PURIFICATION 〕━━╮
┃ Groupe : ${meta.subject || "Groupe"}
┃ Début dans : 3 secondes…
┃ ✅ Pour arrêter : *${prefix || "."}stop*
╰━━━━━━━━━━━━━━━━━━━━━━╯`,
      contextInfo: newsletterCtx()
    }, { quoted: m });

    // 3 secondes avec possibilité stop
    for (let i = 3; i >= 1; i--) {
      if (job.stop) {
        global.kickallJobs.delete(from);
        return sock.sendMessage(from, {
          text: "🛑 Purification *annulée*.",
          contextInfo: newsletterCtx()
        }, { quoted: m });
      }
      await delay(1000);
    }

    if (job.stop) {
      global.kickallJobs.delete(from);
      return sock.sendMessage(from, {
        text: "🛑 Purification *annulée*.",
        contextInfo: newsletterCtx()
      }, { quoted: m });
    }

    await sock.sendMessage(from, {
      text:
`╭━━〔 🧹 PURIFICATION 〕━━╮
┃ ✅ Début de la purification…
┃ ℹ️ Les admins seront ignorés.
╰━━━━━━━━━━━━━━━━━━━━━━╯`,
      contextInfo: newsletterCtx()
    }, { quoted: m });

    // ✅ liste admins / targets avec normJid
    const admins = participants
      .filter(p => p.admin)
      .map(p => normJid(p.id));

    const targets = participants
      .map(p => normJid(p.id))
      .filter(jid => !admins.includes(jid) && jid !== botId);

    let removed = 0;

    for (const user of targets) {
      if (job.stop) {
        global.kickallJobs.delete(from);
        return sock.sendMessage(from, {
          text: `🛑 Purification stoppée.\n✅ Membres supprimés : ${removed}/${targets.length}`,
          contextInfo: newsletterCtx()
        }, { quoted: m });
      }

      try {
        await sock.groupParticipantsUpdate(from, [user], "remove");
        removed++;
      } catch (e) {
        // ignore erreurs individuelles
      }

      await delay(1100);
    }

    global.kickallJobs.delete(from);

    return sock.sendMessage(from, {
      text:
`✅ *GROUPE PURIFIÉ AVEC SUCCÈS*
👥 Groupe : ${meta.subject || "Groupe"}
🧹 Membres supprimés : ${removed}
🛡️ Admins ignorés : ${admins.length}`,
      contextInfo: newsletterCtx()
    }, { quoted: m });
  }
};