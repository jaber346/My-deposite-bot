const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "../data/antibot.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
}

function readDb() {
  ensureDb();
  try {
    const j = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function writeDb(arr) {
  fs.writeFileSync(dbPath, JSON.stringify(arr, null, 2));
}

function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

async function isSenderAdmin(sock, from, sender) {
  const meta = await sock.groupMetadata(from);
  const s = normJid(sender);
  const p = (meta.participants || []).find(x => normJid(x.id) === s);
  return Boolean(p?.admin);
}

module.exports = {
  name: "antibot",
  category: "Security",
  description: "Anti-bot on/off (groupe)",

  async execute(sock, m, args, { isGroup, prefix, isOwner, sender } = {}) {
    const from = m.key.remoteJid;

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Cette commande fonctionne uniquement en groupe." }, { quoted: m });
    }

    // Owner ou admin
    const senderIsAdmin = await isSenderAdmin(sock, from, sender);
    if (!isOwner && !senderIsAdmin) {
      return sock.sendMessage(from, { text: "🚫 Seuls les admins (ou owner) peuvent utiliser cette commande." }, { quoted: m });
    }

    const sub = (args[0] || "").toLowerCase();
    let db = readDb();

    if (sub === "on") {
      if (!db.includes(from)) db.push(from);
      writeDb(db);
      return sock.sendMessage(from, { text: "✅ AntiBot activé pour ce groupe." }, { quoted: m });
    }

    if (sub === "off") {
      db = db.filter(g => g !== from);
      writeDb(db);
      return sock.sendMessage(from, { text: "❌ AntiBot désactivé." }, { quoted: m });
    }

    return sock.sendMessage(from, { text: `Utilisation :\n${prefix}antibot on\n${prefix}antibot off` }, { quoted: m });
  }
};