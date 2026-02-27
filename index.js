// ==================== index.js (NOVA XMD V1) ====================
// ✅ 100% CommonJS | ✅ Pair route: /pair | ✅ Store AntiDelete (2 keys) | ✅ Welcome + Preview chaîne

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = require("./config");

// handlers (safe load)
let newsletterHandler = async () => {};
let antideleteHandler = async () => {};
let welcomeHandler = async () => {};
try { newsletterHandler = require("./data/newsletter.js"); } catch {}
try { antideleteHandler = require("./data/antidelete.js"); } catch {}
try { welcomeHandler = require("./data/welcome.js"); } catch {}

const app = express();
const port = process.env.PORT || 3000;

const sessionsDir = path.join(__dirname, "accounts");
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

let tempSocks = {};
global.msgStore = global.msgStore || {};
global.owner = String(config.OWNER_NUMBER || "").replace(/[^0-9]/g, "");
global.botStartTime = global.botStartTime || Date.now();

// ✅ static files (index.html etc)
app.use(express.static(__dirname));

// ==================== HELPERS ====================
function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function newsletterContext() {
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

// (Optionnel) Carte style “bouton Voir Channel” (le lien n’apparait pas dans le texte)
function channelCardContext() {
  return {
    ...newsletterContext(),
    externalAdReply: {
      title: config.BOT_NAME || "NOVA XMD V1",
      body: "Voir Channel • Updates & News",
      thumbnailUrl: "https://files.catbox.moe/jf30v4.png",
      sourceUrl: "https://whatsapp.com/channel/0029VbBrAUYAojYjf3Ndw70d",
      mediaType: 1,
      renderLargerThumbnail: true,
      showAdAttribution: false
    }
  };
}

// ===============================
// START BOT
// ===============================
async function startUserBot(phoneNumber, isPairing = false) {
  const cleanNumber = String(phoneNumber || "").replace(/[^0-9]/g, "");
  const sessionName = `session_${cleanNumber}`;
  const sessionPath = path.join(sessionsDir, sessionName);

  // reset session si pairing
  if (isPairing) {
    if (tempSocks[sessionName]) {
      try { tempSocks[sessionName].end(); } catch {}
      delete tempSocks[sessionName];
    }
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  // ✅ Mode runtime (modifiable via setMode dans case.js)
  let currentMode = (config.MODE || "public").toLowerCase();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
    }
  });

  tempSocks[sessionName] = sock;

  // --- Connection update ---
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      if (reason !== DisconnectReason.loggedOut) {
        console.log(`[${cleanNumber}] Reconnexion...`);
        startUserBot(cleanNumber);
      } else {
        console.log(`[${cleanNumber}] Déconnecté (loggedOut).`);
      }
    }

    if (connection === "open") {
      console.log(`✅ [${cleanNumber}] Session connectée`);

      try {
        const userJid = normJid(sock.user?.id);
        const modeTxt = String(currentMode || "public").toUpperCase();

        await sock.sendMessage(
          userJid,
          {
            text:
`╭━━〔 🤖 *${config.BOT_NAME || "NOVA XMD V1"}* 〕━━╮
┃ ✅ CONNECTÉ AVEC SUCCÈS
┃ 👨‍💻 Developer : ${config.OWNER_NAME || "DEV NOVA"}
┃ 🌐 Mode : ${modeTxt}
┣━━━━━━━━━━━━━━━━━━
┃ 📢 Rejoins la chaîne officielle
┃ 🔔 Updates • News • Support
╰━━━━━━━━━━━━━━━━━━╯`,
            contextInfo: channelCardContext()
          }
        );
      } catch (err) {
        console.log("WELCOME ERROR:", err?.message || err);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // --- Messages upsert (commands + store antidelete) ---
  sock.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const m = chatUpdate.messages?.[0];
      if (!m || !m.message) return;

      const jid = m.key.remoteJid;

      // Ignore status
      if (jid === "status@broadcast") {
        try { await sock.readMessages([m.key]); } catch {}
        return;
      }

      // =========================
      // ✅ STORE FOR ANTIDELETE
      // =========================
      // clé simple
      global.msgStore[m.key.id] = m;
      // clé composite (utile selon update)
      global.msgStore[`${m.key.remoteJid}:${m.key.id}`] = m;

      setTimeout(() => {
        delete global.msgStore[m.key.id];
        delete global.msgStore[`${m.key.remoteJid}:${m.key.id}`];
      }, 7200000);

      // Newsletter handler (si tu l'utilises)
      try { await newsletterHandler(sock, m); } catch {}

      // Commands
      const cmdHandler = require("./case.js");
      const usedPrefix = config.PREFIX || ".";
      await cmdHandler(
        sock,
        m,
        usedPrefix,
        (newMode) => { currentMode = String(newMode || "public").toLowerCase(); },
        currentMode
      );
    } catch (err) {
      console.log("UPSERT ERROR:", err?.message || err);
    }
  });

  // --- messages.update (antidelete) ---
  sock.ev.on("messages.update", async (updates) => {
    try {
      for (const upd of updates) {
        // ton handler lit upd.key / upd.update
        await antideleteHandler(sock, upd);
      }
    } catch (e) {
      console.log("messages.update error:", e?.message || e);
    }
  });
  // welcome/goodbye
  sock.ev.on("group-participants.update", async (upd) => {
    try {
      await welcomeHandler(sock, upd);
    } catch {}
  });

  return sock;
}


// ===============================
// RESTORE SESSIONS
// ===============================
async function restoreSessions() {
  if (!fs.existsSync(sessionsDir)) return;

  const folders = fs.readdirSync(sessionsDir);
  for (const folder of folders) {
    if (folder.startsWith("session_")) {
      const phoneNumber = folder.replace("session_", "");
      console.log(`🔄 Restore: ${phoneNumber}`);
      await startUserBot(phoneNumber);
      await delay(4000);
    }
  }
}

// ===============================
// ROUTES
// ===============================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Pair route expected by index.html
app.get("/pair", async (req, res) => {
  try {
    const num = String(req.query.number || "").replace(/[^0-9]/g, "");
    if (!num || num.length < 8) {
      return res.status(400).json({ error: "Numéro invalide" });
    }

    const sock = await startUserBot(num, true);
    await delay(2500);

    const code = await sock.requestPairingCode(num);
    return res.json({ code });
  } catch (e) {
    console.log("PAIR ERROR:", e?.message || e);
    return res.status(500).json({ error: "Impossible de générer le code" });
  }
});

// ===============================
// SERVER
// ===============================
app.listen(port, async () => {
  console.log(`🌐 ${config.BOT_NAME || "NOVA XMD V1"} prêt : http://localhost:${port}`);
  global.botStartTime = Date.now();
  await restoreSessions();
});