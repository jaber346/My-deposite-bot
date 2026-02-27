// commands/delete.js
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

function getQuotedKey(m) {
  const ctx = m.message?.extendedTextMessage?.contextInfo;
  const q = ctx?.quotedMessage;
  if (!q) return null;

  // stanzaId = id du message cité
  const id = ctx.stanzaId;
  if (!id) return null;

  const remoteJid = m.key.remoteJid;

  // participant existe surtout en groupe
  const participant = ctx.participant;

  return {
    remoteJid,
    id,
    fromMe: false, // on force false, WhatsApp ignore souvent, participant fait foi
    participant
  };
}

module.exports = {
  name: "delete",
  category: "Tools",
  description: "Supprimer un message (DM & Groupe) en répondant au message",

  async execute(sock, m, args, { isGroup, prefix } = {}) {
    const from = m.key.remoteJid;
    const botJid = normJid(sock.user?.id || "");
    const sub = (args[0] || "").toLowerCase(); // "me" optionnel

    const quotedKey = getQuotedKey(m);
    if (!quotedKey) {
      return sock.sendMessage(
        from,
        { text: `⚠️ Réponds à un message puis tape *${prefix || config.PREFIX || "."}del*`, contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    // ---- Permissions WhatsApp ----
    // DM: seulement messages du bot (ou parfois très limité)
    // Groupe: bot admin peut supprimer messages des autres
    let canDeleteOthersInGroup = false;

    if (isGroup) {
      try {
        const meta = await sock.groupMetadata(from);
        const botIsAdmin = isAdmin(meta, botJid);
        canDeleteOthersInGroup = botIsAdmin;
      } catch {}
    }

    // Si l’utilisateur demande "me" → suppression locale (souvent non supportée comme "Delete for me" via Baileys)
    // Donc on fait simple: on tente delete normal, sinon message.
    if (sub === "me") {
      // On tente quand même le delete normal
    }

    // Si DM et message pas du bot → refuser proprement
    // On essaye d’estimer : si participant existe en DM, c’est l’autre.
    // En DM, participant est souvent undefined, donc on utilise une règle simple:
    // -> on tente, si échec, on dit la raison probable.
    try {
      await sock.sendMessage(from, { delete: quotedKey });
      return; // ✅ supprimé
    } catch (e) {
      // cas groupe: bot pas admin
      if (isGroup && !canDeleteOthersInGroup) {
        return sock.sendMessage(
          from,
          {
            text: "❌ Je ne peux pas supprimer les messages des autres.\n✅ Mets le bot *admin* (ou supprime seulement les messages du bot).",
            contextInfo: newsletterCtx()
          },
          { quoted: m }
        );
      }

      // cas DM: WhatsApp interdit de supprimer message de l’autre
      return sock.sendMessage(
        from,
        {
          text: "❌ Suppression refusée par WhatsApp.\nℹ️ En privé, je peux supprimer seulement *mes messages*.\nℹ️ En groupe, je dois être *admin* pour supprimer ceux des autres.",
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    }
  }
};

// alias (si ton loader supporte alias, sinon duplique un fichier del.js)
module.exports.alias = ["del", "suppr"];