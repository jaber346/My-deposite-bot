// ==================== commands/antidelete.js ====================
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../data/antidelete.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ enabled: false, mode: "chat" }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return { enabled: false, mode: "chat" };
  }
}

module.exports = {
  name: "antidelete",
  category: "Security",
  description: "Activer/Désactiver antidelete + destination (chat/inbox)",

  async execute(sock, m, args, { prefix, isOwner } = {}) {
    const from = m.key.remoteJid;

    if (!isOwner) {
      return sock.sendMessage(from, { text: "🚫 Commande réservée au propriétaire." }, { quoted: m });
    }

    const db = readDb();
    const sub = (args[0] || "").toLowerCase();

    if (sub === "on") {
      db.enabled = true;
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      return sock.sendMessage(from, { text: "✅ Antidelete activé." }, { quoted: m });
    }

    if (sub === "off") {
      db.enabled = false;
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      return sock.sendMessage(from, { text: "❌ Antidelete désactivé." }, { quoted: m });
    }

    // optionnel: choisir où renvoyer les messages supprimés
    if (sub === "mode") {
      const mode = (args[1] || "").toLowerCase();
      if (mode !== "chat" && mode !== "inbox") {
        return sock.sendMessage(from, { text: `Utilisation : ${prefix}antidelete mode chat|inbox` }, { quoted: m });
      }
      db.mode = mode;
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      return sock.sendMessage(from, { text: `✅ Destination antidelete : *${mode}*` }, { quoted: m });
    }

    return sock.sendMessage(from, {
      text:
`Utilisation :
${prefix}antidelete on
${prefix}antidelete off
${prefix}antidelete mode chat|inbox`
    }, { quoted: m });
  }
};