// commands/setpp.js
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
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

function isAdmin(meta, jid) {
  const n = normJid(jid);
  const p = (meta.participants || []).find(x => normJid(x.id) === n);
  return Boolean(p?.admin);
}

// ============ helpers quoted ============
function getContextInfo(m) {
  return m.message?.extendedTextMessage?.contextInfo || {};
}

function getQuotedMessage(m) {
  const ctx = getContextInfo(m);
  return ctx.quotedMessage || null;
}

// image dans quoted (support viewOnce)
function getQuotedImageMessage(m) {
  const q = getQuotedMessage(m);
  if (!q) return null;

  if (q.imageMessage) return q.imageMessage;

  const vo = q.viewOnceMessageV2 || q.viewOnceMessage;
  const inner = vo?.message || {};
  if (inner.imageMessage) return inner.imageMessage;

  return null;
}

async function imageMsgToBuffer(imgMsg) {
  const stream = await downloadContentFromMessage(imgMsg, "image");
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

// cible pour PP download:
// 1) mention (@tag)
// 2) reply à quelqu'un
// 3) en PV -> l'interlocuteur
function getTargetJidForProfile(m) {
  const ctx = getContextInfo(m);
  const mentioned = ctx.mentionedJid?.[0];
  if (mentioned) return normJid(mentioned);

  // si reply à un message, on prend le participant du message cité
  const participant = ctx.participant; // souvent présent en groupe
  if (participant) return normJid(participant);

  // fallback : si PV, remoteJid = la personne
  const from = m.key.remoteJid;
  if (from && from.endsWith("@s.whatsapp.net")) return normJid(from);

  return null;
}

async function getProfileUrl(sock, jid) {
  try {
    // 'image' pour PP
    return await sock.profilePictureUrl(jid, "image");
  } catch {
    return null;
  }
}

module.exports = {
  name: "setpp",
  category: "Group",
  description: "Changer photo groupe (reply image) OU envoyer la PP d'un membre (tag/reply/pv)",

  async execute(sock, m, args, { isGroup, isOwner } = {}) {
    const from = m.key.remoteJid;
    const sender = normJid(m.key.participant || m.sender || "");
    const botJid = normJid(sock.user.id);

    // ✅ Si on répond à une image => CHANGER PP GROUPE (ou bot en PV)
    const imgMsg = getQuotedImageMessage(m);

    if (imgMsg) {
      // ----- GROUPE : change PP du groupe -----
      if (isGroup) {
        const meta = await sock.groupMetadata(from);

        if (!isAdmin(meta, botJid)) {
          return sock.sendMessage(
            from,
            { text: "❌ Je dois être *admin* pour changer la photo du groupe.", contextInfo: newsletterCtx() },
            { quoted: m }
          );
        }

        if (!isAdmin(meta, sender)) {
          return sock.sendMessage(
            from,
            { text: "🚫 Seuls les *admins* peuvent changer la photo du groupe.", contextInfo: newsletterCtx() },
            { quoted: m }
          );
        }

        try {
          const buffer = await imageMsgToBuffer(imgMsg);
          await sock.updateProfilePicture(from, buffer);

          return sock.sendMessage(
            from,
            { text: "✅ Photo du groupe mise à jour.", contextInfo: newsletterCtx() },
            { quoted: m }
          );
        } catch {
          return sock.sendMessage(from, { text: "❌ Erreur: impossible de changer la photo du groupe." }, { quoted: m });
        }
      }

      // ----- PV : change PP du bot (owner seulement) -----
      if (!isOwner) {
        return sock.sendMessage(from, { text: "🚫 Owner seulement pour changer la photo du bot (en PV)." }, { quoted: m });
      }

      try {
        const buffer = await imageMsgToBuffer(imgMsg);
        await sock.updateProfilePicture(botJid, buffer);

        return sock.sendMessage(
          from,
          { text: "✅ Photo du bot mise à jour.", contextInfo: newsletterCtx() },
          { quoted: m }
        );
      } catch {
        return sock.sendMessage(from, { text: "❌ Erreur: impossible de changer la photo du bot." }, { quoted: m });
      }
    }

    // ✅ Sinon (pas d’image en reply) => ENVOYER LA PP de quelqu’un
    const target = getTargetJidForProfile(m);
    if (!target) {
      return sock.sendMessage(
        from,
        { text: `Utilisation :\n- ${config.PREFIX || "."}setpp @tag\n- Réponds à quelqu’un puis ${config.PREFIX || "."}setpp\n- En PV: ${config.PREFIX || "."}setpp`, contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    const url = await getProfileUrl(sock, target);

    if (!url) {
      return sock.sendMessage(
        from,
        { text: "❌ Cette personne n’a pas de photo de profil visible (privacy).", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    return sock.sendMessage(
      from,
      {
        image: { url },
        caption:
`╭━━〔 🖼️ PROFILE PHOTO 〕━━╮
┃ 👤 User : @${target.split("@")[0]}
╰━━━━━━━━━━━━━━━━━━━━━━╯`,
        mentions: [target],
        contextInfo: newsletterCtx()
      },
      { quoted: m }
    );
  }
};