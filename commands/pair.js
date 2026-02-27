// commands/pair.js
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay
} = require("@whiskeysockets/baileys");

const config = require("../config");

function onlyDigits(s) {
  return String(s || "").replace(/[^0-9]/g, "");
}

module.exports = {
  name: "pair",
  category: "Owner",
  description: "Générer un code de pairing WhatsApp (owner only)",

  async execute(sock, m, args, { isOwner, prefix } = {}) {
    const from = m.key.remoteJid;

    if (!isOwner) {
      return sock.sendMessage(from, { text: "🚫 Commande réservée au propriétaire." }, { quoted: m });
    }

    const num = onlyDigits(args[0]);
    if (!num || num.length < 8) {
      return sock.sendMessage(
        from,
        { text: `Utilisation : ${prefix}pair 226XXXXXXXX` },
        { quoted: m }
      );
    }

    await sock.sendMessage(from, { text: "⏳ Génération du code en cours..." }, { quoted: m });

    // Dossier temporaire de pairing
    const accountsDir = path.join(__dirname, "..", "accounts");
    if (!fs.existsSync(accountsDir)) fs.mkdirSync(accountsDir, { recursive: true });

    const sessionDir = path.join(accountsDir, `pair_${num}`);
    // reset pour être sûr que c’est une session vierge
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version } = await fetchLatestBaileysVersion();

      const tmpSock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["NOVA XMD V1", "Chrome", "1.0.0"],
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
      });

      tmpSock.ev.on("creds.update", saveCreds);

      // petite attente sinon WhatsApp répond parfois rien
      await delay(2500);

      const code = await tmpSock.requestPairingCode(num);

      // fermer socket temporaire
      try { tmpSock.end(); } catch {}

      if (!code) throw new Error("No code returned");

      const newsletterContext = {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363423249667073@newsletter",
          newsletterName: config.BOT_NAME || "NOVA XMD V1",
          serverMessageId: 1
        }
      };

      return sock.sendMessage(
        from,
        {
          text:
`╭━━〔 🤖 *${config.BOT_NAME || "NOVA XMD V1"}* 〕━━╮
┃ ✅ PAIRING CODE GÉNÉRÉ
┃ 📱 Numéro : ${num}
┃ 🔑 Code : *${code}*
╰━━━━━━━━━━━━━━━━━━━━━━╯`,
          contextInfo: newsletterContext
        },
        { quoted: m }
      );
    } catch (e) {
      // nettoyage si échec
      try { if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}

      return sock.sendMessage(
        from,
        { text: "❌ Impossible de générer le code. Vérifie le numéro et réessaie." },
        { quoted: m }
      );
    }
  }
};