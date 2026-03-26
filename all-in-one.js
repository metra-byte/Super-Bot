// all-in-one.js
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes
} from "discord.js";
import crypto from "crypto";
import fetch from "node-fetch";

// ================= CONFIG =================
const TOKEN = process.env.BOT_TOKEN; // set in hosting or locally
const CLIENT_ID = process.env.CLIENT_ID || "YOUR_CLIENT_ID";
const OWNER_ID = "1396088469624852540";

// 1 hour
const TOKEN_EXPIRY = 60 * 60 * 1000;

// ==========================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages]
});

// ===== STORAGE =====
const tempKeys = new Map();
const userTokens = new Map();

// ===== TOKEN SYSTEM =====
function setToken(userId, token) {
  const expires = Date.now() + TOKEN_EXPIRY;
  userTokens.set(userId, { token, expires });
  setTimeout(() => userTokens.delete(userId), TOKEN_EXPIRY);
}

function getToken(userId) {
  const data = userTokens.get(userId);
  if (!data) return null;
  if (Date.now() > data.expires) {
    userTokens.delete(userId);
    return null;
  }
  return data.token;
}

// ===== KEYGEN =====
function generateKey(type = "ed25519") {
  return type === "rsa"
    ? crypto.generateKeyPairSync("rsa", {
        modulusLength: 4096,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" }
      })
    : crypto.generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" }
      });
}

// ===== DEPLOY =====
async function deploy(token, project, branch = "main") {
  const query = `
    mutation CreateDeployment($projectId: ID!, $branch: String!) {
      createDeployment(input: {
        projectId: $projectId,
        branch: $branch
      }) {
        id
        link
        status
      }
    }
  `;

  try {
    const res = await fetch("https://backboard.railway.app/graphql/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ query, variables: { projectId: project, branch } })
    });

    const data = await res.json();
    if (data.errors) return { error: data.errors.map(e => e.message).join(", ") };
    return data?.data?.createDeployment;
  } catch (err) {
    return { error: err.message };
  }
}

// ===== COMMANDS =====
const commands = [
  { name: "keygen", description: "Generate SSH key" },
  {
    name: "login",
    description: "Login with GitHub token (1h)",
    options: [{ name: "token", type: 3, required: true }]
  },
  {
    name: "deploy",
    description: "Deploy to Railway",
    options: [
      { name: "project", type: 3, required: true },
      { name: "branch", type: 3, required: false }
    ]
  },
  {
    name: "run",
    description: "Run code",
    options: [
      { name: "language", type: 3, required: true },
      { name: "code", type: 3, required: true }
    ]
  }
];

// ===== REGISTER =====
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Commands registered");
})();

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;

  // KEYGEN
  if (interaction.commandName === "key