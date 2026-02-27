const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "../data/welcome.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ welcome: false, goodbye: false }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return { welcome: false, goodbye: false };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function newsletterCtx() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363423249667073@newsletter",
      newsletterName: config.BOT_NAME || "NOVA XMD V1",
      serverMessageId: 1,
    },
  };
}

module.exports = {
  name: "welcome",
  category: "Group",
  description: "Welcome on/off",

  async execute(sock, m, args, { prefix, isGroup, isAdminOrOwner } = {}) {
    const from = m.key.remoteJid;

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Commande uniquement en groupe." }, { quoted: m });
    }

    if (!isAdminOrOwner) {
      return sock.sendMessage(from, { text: "🚫 Admin requis." }, { quoted: m });
    }

    const sub = (args[0] || "").toLowerCase();
    const db = readDb();

    if (sub === "on") {
      db.welcome = true;
      writeDb(db);
      return sock.sendMessage(from, { text: "✅ Welcome activé.", contextInfo: newsletterCtx() }, { quoted: m });
    }

    if (sub === "off") {
      db.welcome = false;
      writeDb(db);
      return sock.sendMessage(from, { text: "❌ Welcome désactivé.", contextInfo: newsletterCtx() }, { quoted: m });
    }

    return sock.sendMessage(
      from,
      {
        text: `Utilisation :\n${prefix || "."}welcome on\n${prefix || "."}welcome off`,
        contextInfo: newsletterCtx(),
      },
      { quoted: m }
    );
  },
};
