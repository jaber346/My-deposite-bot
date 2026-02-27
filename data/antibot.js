const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "antibot.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
  }
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

function normJid(jid = "") {
  jid = String(jid || "");
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

// Détection simple bots
function isLikelyBotMessage(m) {
  const msg = m.message || {};

  if (msg.templateMessage) return true;
  if (msg.buttonsMessage) return true;
  if (msg.listMessage) return true;
  if (msg.interactiveMessage) return true;

  return false;
}

module.exports = async (sock, m) => {
  try {
    if (!m?.message) return;

    const from = m.key.remoteJid;
    if (!from || !from.endsWith("@g.us")) return;

    const enabledGroups = readDb();
    if (!enabledGroups.includes(from)) return;

    if (m.key.fromMe) return;

    const sender = normJid(m.key.participant || m.participant);
    if (!sender) return;

    if (!isLikelyBotMessage(m)) return;

    const meta = await sock.groupMetadata(from);

    const botJid = normJid(sock.user?.id || "");
    const botIsAdmin = isAdmin(meta, botJid);

    if (!botIsAdmin) return;

    if (isAdmin(meta, sender)) return;

    await sock.groupParticipantsUpdate(from, [sender], "remove");

    await sock.sendMessage(
      from,
      {
        text: `🤖 *ANTIBOT*\n\n🚫 Bot détecté et supprimé : @${sender.split("@")[0]}`,
        mentions: [sender]
      },
      { quoted: m }
    );

  } catch (e) {
    console.log("ANTIBOT ERROR:", e?.message || e);
  }
};