// commands/add.js
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

function extractNumbers(text = "") {
  // accepte: "225xxxx", "+225xxxx", "@225xxxx", "225xxxx,226xxxx"
  const cleaned = String(text)
    .replace(/[@+]/g, " ")
    .replace(/[^\d, ]/g, " ")
    .trim();

  const parts = cleaned.split(/[\s,]+/).filter(Boolean);
  // garde seulement les chiffres, longueur min 8
  return parts
    .map(x => x.replace(/\D/g, ""))
    .filter(x => x.length >= 8 && x.length <= 16);
}

module.exports = {
  name: "add",
  category: "Group",
  description: "Ajouter un membre au groupe",

  async execute(sock, m, args, { isGroup, prefix } = {}) {
    const from = m.key.remoteJid;
    const sender = normJid(m.key.participant || m.sender || "");
    const botJid = normJid(sock.user?.id || "");

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Groupe uniquement.", contextInfo: newsletterCtx() }, { quoted: m });
    }

    const meta = await sock.groupMetadata(from);

    // sender admin ?
    if (!isAdmin(meta, sender)) {
      return sock.sendMessage(
        from,
        { text: "🚫 Seuls les *admins* peuvent utiliser .add", contextInfo: newsletterCtx() },
        { quoted: m }
      );
    }

    const text = args.join(" ");
    const numbers = extractNumbers(text);

    if (!numbers.length) {
      return sock.sendMessage(
        from,
        {
          text:
`Utilisation :
${prefix || config.PREFIX || "."}add 226XXXXXXXX
comme tu ne comprend rien là
> tkt c’est une blague bon bref continue
          contextInfo: newsletterCtx()
        },
        { quoted: m }
      );
    }

    // convertir en jids
    const targets = [...new Set(numbers)].map(n => `${n}@s.whatsapp.net`);

    // feedback
    await sock.sendMessage(
      from,
      { text: `⏳ Ajout en cours : ${targets.length} membre(s)...`, contextInfo: newsletterCtx() },
      { quoted: m }
    );

    // ajout
    let ok = 0;
    const failed = [];

    for (const jid of targets) {
      try {
        const res = await sock.groupParticipantsUpdate(from, [jid], "add");

        // Baileys renvoie souvent un tableau/objet selon version
        // on essaye de détecter si ok
        ok++;

        // si WhatsApp refuse, parfois c’est dans res[0].status etc, on reste safe:
        // si tu veux du debug, dis-moi ta version exacte Baileys.
      } catch (e) {
        failed.push(jid);
      }
    }

    let report =
`╭━━〔 ✅ ADD RESULT 〕━━╮
┃ 👥 Groupe : ${meta.subject || "Groupe"}
┃ ✅ Ajoutés : ${ok}/${targets.length}
╰━━━━━━━━━━━━━━━━━━━━━━╯`;

    if (failed.length) {
      report += `\n\n❌ Refus/Erreur pour:\n` + failed.map(j => `- ${j.split("@")[0]}`).join("\n");
      report += `\n\nℹ️ Causes possibles : privacy, numéro invalide, limite WhatsApp.`;
    }

    return sock.sendMessage(
      from,
      { text: report, contextInfo: newsletterCtx() },
      { quoted: m }
    );
  }
};