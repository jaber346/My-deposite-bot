const fs = require("fs");
const path = require("path");
const config = require("../config");

const dbPath = path.join(__dirname, "welcome.json");

const WELCOME_IMAGES = [
  "https://files.catbox.moe/iqejld.jpg",
  "https://files.catbox.moe/0p867k.jpg",
  "https://files.catbox.moe/k35kko.jpg",
  "https://files.catbox.moe/zxyyrr.jpg",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ welcome: false, goodbye: false }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const d = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    return {
      welcome: !!d.welcome,
      goodbye: !!d.goodbye,
    };
  } catch {
    return { welcome: false, goodbye: false };
  }
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

module.exports = async (sock, update) => {
  try {
    const db = readDb();

    const id = update?.id;
    const participants = update?.participants || [];
    const action = update?.action; // add/remove/promote/demote/...

    if (!id || !Array.isArray(participants) || participants.length === 0) return;

    if (action !== "add" && action !== "remove") return;

    if (action === "add" && !db.welcome) return;
    if (action === "remove" && !db.goodbye) return;

    // metadata
    let meta;
    try {
      meta = await sock.groupMetadata(id);
    } catch {
      meta = { subject: "Groupe", participants: [] };
    }

    const groupName = meta?.subject || "Groupe";
    const total = meta?.participants?.length || "?";

    for (const jid of participants) {
      const user = String(jid || "");
      const num = user.includes("@") ? user.split("@")[0] : user;

      const caption =
        action === "add"
          ? `╭━━〔 🎉 BIENVENUE 〕━━╮\n┃ 👤 @${num}\n┃ 🏷️ Groupe : ${groupName}\n┃ 👥 Membres : ${total}\n┃ 🤖 Bot : ${config.BOT_NAME || "NOVA XMD V1"}\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n✨ Bienvenue dans le groupe ! Respecte les règles ✅`
          : `╭━━〔 👋 AU REVOIR 〕━━╮\n┃ 👤 @${num}\n┃ 🏷️ Groupe : ${groupName}\n┃ 🤖 Bot : ${config.BOT_NAME || "NOVA XMD V1"}\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n😢 Un membre a quitté le groupe.`;

      await sock.sendMessage(
        id,
        {
          image: { url: pick(WELCOME_IMAGES) },
          caption,
          mentions: [user],
          contextInfo: newsletterCtx(),
        },
        {}
      );
    }
  } catch (e) {
    console.log("WELCOME HANDLER ERROR:", e?.message || e);
  }
};
