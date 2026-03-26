// all-in-one.js
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder
} from "discord.js";
import crypto from "crypto";
import fetch from "node-fetch";

// ================= CONFIG =================
// NOTE: Remove your actual bot token for open-source safety
const OWNER_ID = "1396088469624852540"; // only one owner
// TOKEN will be provided via environment variable: process.env.TOKEN
const TOKEN = process.env.TOKEN || ""; 
const CLIENT_ID = process.env.CLIENT_ID || "";

// ==========================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: ["CHANNEL"]
});

// ===== In-memory storage =====
const tempKeys = new Map();   // ephemeral SSH keys
const userTokens = new Map(); // GitHub tokens

// ===== TOKEN SYSTEM =====
function setToken(userId, token) {
  const expires = Date.now() + 3600 * 1000; // 1 hour
  userTokens.set(userId, { token, expires });
  setTimeout(() => userTokens.delete(userId), 3600 * 1000);
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

// ===== SSH KEYGEN =====
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

// ===== RAILWAY DEPLOY =====
async function deploy(token, project, branch = "main") {
  const query = `
    mutation CreateDeployment($projectId: ID!, $branch: String!) {
      createDeployment(input: { projectId: $projectId, branch: $branch }) {
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
  {
    name: "keygen",
    description: "Generate ephemeral SSH key",
    options: [
      { name: "type", type: 3, description: "rsa or ed25519", required: false }
    ]
  },
  {
    name: "login",
    description: "Login with GitHub token",
    options: [
      { name: "token", type: 3, description: "GitHub token", required: true }
    ]
  },
  {
    name: "deploy",
    description: "Deploy to Railway",
    options: [
      { name: "project", type: 3, required: true, description: "Project ID" },
      { name: "branch", type: 3, required: false, description: "Branch" }
    ]
  },
  {
    name: "run",
    description: "Run code snippet",
    options: [
      { name: "language", type: 3, required: true, description: "Language" },
      { name: "code", type: 3, required: true, description: "Code snippet" }
    ]
  }
];

// ===== REGISTER COMMANDS =====
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  if (!TOKEN || !CLIENT_ID) return console.log("⚠ TOKEN or CLIENT_ID not set.");
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Commands registered");
})();

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;

  // ===== /keygen =====
  if (interaction.commandName === "keygen") {
    const type = interaction.options.getString("type") || "ed25519";
    const { publicKey, privateKey } = generateKey(type);

    tempKeys.set(userId, privateKey);

    const dmEmbed = new EmbedBuilder()
      .setTitle("🔑 Your SSH Key")
      .setDescription("Private key is **ephemeral**. Public key included.")
      .setColor(0x00ff00)
      .addFields(
        { name: "Private Key", value: `\`
      ${privateKey}\`
      ` },
        { name: "Public Key", value: `\`
      ${publicKey}\`
      ` }
      )
      .setFooter({ text: "Private • DM only" });

    try {
      await interaction.user.send({ embeds: [dmEmbed] });
      return interaction.reply({ content: "✅ Key sent via DM", ephemeral: true });
    } catch {
      return interaction.reply({ content: "❌ Enable DMs", ephemeral: true });
    }
  }

  // ===== /login =====
  if (interaction.commandName === "login") {
    const token = interaction.options.getString("token");
    if (!token.startsWith("ghp_") && !token.startsWith("github_pat_"))
      return interaction.reply({ content: "❌ Invalid GitHub token", ephemeral: true });

    setToken(userId, token);
    return interaction.reply({ content: "✅ Logged in (1h)", ephemeral: true });
  }

  // ===== /deploy =====
  if (interaction.commandName === "deploy") {
    const token = getToken(userId);
    if (!token) return interaction.reply({ content: "❌ Login first (/login)", ephemeral: true });

    const project = interaction.options.getString("project");
    const branch = interaction.options.getString("branch") || "main";

    const result = await deploy(token, project, branch);
    if (result?.error) return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });

    return interaction.reply({
      content: `🚀 Deploy started!\nLink: ${result.link}\nStatus: ${result.status}`,
      ephemeral: true
    });
  }

  // ===== /run =====
  if (interaction.commandName === "run") {
    const lang = interaction.options.getString("language");
    const code = interaction.options.getString("code");

    return interaction.reply({
      content: `🖥️ ${lang}:\n\`
      ${code}\`
      `,
      ephemeral: true
    });
  }
});

// ===== START =====
if (TOKEN) client.login(TOKEN);
else console.log("⚠ TOKEN not provided. Set process.env.TOKEN to run bot.");