const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../data/antidelete.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(
      dbPath,
      JSON.stringify({ enabled: false, mode: "chat" }, null, 2)
    );
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

function normJid(jid = "") {
  jid = String(jid || "");
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

module.exports = async (sock, chatUpdate) => {
  try {
    const db = readDb();
    if (!db.enabled) return;

    const key = chatUpdate?.key;
    const update = chatUpdate?.update;
    if (!key || !update) return;

    const pm = update.protocolMessage;
    if (!pm || pm.type !== 0) return;

    const deletedId = pm.key?.id;
    const deletedRemote = pm.key?.remoteJid || key.remoteJid;
    if (!deletedId) return;

    // ✅ chercher dans le store (id simple puis id+remote)
    const store = global.msgStore || {};
    const originMsg =
      store[deletedId] ||
      store[`${deletedRemote}:${deletedId}`] ||
      store[`${key.remoteJid}:${deletedId}`];

    if (!originMsg) {
      console.log("[ANTIDELETE] Introuvable:", deletedId, "in", deletedRemote);
      return;
    }

    const from = key.remoteJid;

    // ✅ sender safe + normalisé
    let sender =
      originMsg.key?.participant ||
      originMsg.participant ||
      originMsg.key?.remoteJid ||
      from;

    sender = normJid(sender);

    // destination
    const ownerNumber = require("../config").OWNER_NUMBER || "";
    const ownerJid = String(ownerNumber).replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const destination = db.mode === "inbox" ? ownerJid : from;

    const mentionList = sender.includes("@") ? [sender] : [];

    await sock.sendMessage(
      destination,
      {
        text:
`🚫 *ANTIDELETE DÉTECTÉ* 🚫

👤 De : ${sender.includes("@") ? "@" + sender.split("@")[0] : "Inconnu"}
📍 Lieu : ${from.endsWith("@g.us") ? "Groupe" : "Privé"}`,
        mentions: mentionList
      },
      { quoted: originMsg }
    );

    await sock.copyNForward(destination, originMsg, true);

    // ✅ cleanup des deux clés
    delete store[deletedId];
    delete store[`${deletedRemote}:${deletedId}`];
    delete store[`${key.remoteJid}:${deletedId}`];
  } catch (e) {
    console.log("ANTIDELETE HANDLER ERROR:", e?.message || e);
  }
};