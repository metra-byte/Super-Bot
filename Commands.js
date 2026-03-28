import dotenv from "dotenv";
dotenv.config();

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} from "discord.js";

import fetch from "node-fetch";

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const PREFIX = "./";

// ================= GITHUB COMMAND SOURCE =================
const REPO_OWNER = "metra-byte";
const REPO_NAME = "Super-Bot";
const COMMANDS_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/commands`;

let cache = [];
let lastFetch = 0;

async function getCommands() {
  if (Date.now() - lastFetch < 30000) return cache;

  try {
    const res = await fetch(COMMANDS_URL);
    const files = await res.json();

    const cmds = [];

    for (const file of files) {
      const raw = await fetch(file.download_url);
      cmds.push(await raw.json());
    }

    cache = cmds;
    lastFetch = Date.now();

    console.log("🔄 GitHub commands synced");
    return cmds;
  } catch (err) {
    console.error("GitHub error:", err);
    return cache;
  }
}

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= SLASH COMMANDS =================
const slashCommands = [
  { name: "ping", description: "Check latency" },
  { name: "sync", description: "Sync GitHub commands" },
  { name: "panel", description: "Reaction role panel" },
  { name: "help", description: "Show commands" }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: slashCommands
    });
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error(err);
  }
})();

// ================= HELP SYSTEM =================
function helpText() {
  return `
📘 COMMANDS

Slash:
/ping
/sync
/panel
/help

Prefix:
./ping
./ban @user
./kick @user
./help

Secret:
/8*&_$#1 → music link

Reaction Roles:
Use /panel
`;
}

// ================= MESSAGE COMMANDS =================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const content = msg.content;

  // ================= SECRET COMMAND =================
  if (content === "./8*&_$#1") {
    return msg.reply("🔥 https://youtu.be/mRD0-GxqHVo");
  }

  // ================= PREFIX COMMANDS =================
  if (content.startsWith(PREFIX)) {
    const args = content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift()?.toLowerCase();

    // HELP
    if (cmd === "help") {
      return msg.reply(helpText());
    }

    // PING
    if (cmd === "ping") {
      return msg.reply(`🏓 ${client.ws.ping}ms`);
    }

    // BAN
    if (cmd === "ban") {
      if (!msg.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return msg.reply("❌ No permission");
      }

      const user = msg.mentions.members.first();
      if (!user) return msg.reply("Mention a user");

      await user.ban();
      return msg.reply("✅ Banned");
    }

    // KICK
    if (cmd === "kick") {
      if (!msg.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        return msg.reply("❌ No permission");
      }

      const user = msg.mentions.members.first();
      if (!user) return msg.reply("Mention a user");

      await user.kick();
      return msg.reply("✅ Kicked");
    }
  }

  // ================= GITHUB COMMANDS =================
  const githubCommands = await getCommands();

  for (const cmd of githubCommands) {
    if (content === cmd.trigger) {
      if (cmd.response?.content) {
        return msg.reply(cmd.response.content);
      }
    }
  }

  // ================= AUTOMOD =================
  if (content.includes("discord.gg")) {
    await msg.delete().catch(() => {});
    msg.channel.send("❌ Invite links are not allowed.");
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "ping") {
      return interaction.reply(`🏓 ${client.ws.ping}ms`);
    }

    if (interaction.commandName === "sync") {
      lastFetch = 0;
      await getCommands();
      return interaction.reply({ content: "🔄 Synced GitHub commands", ephemeral: true });
    }

    if (interaction.commandName === "help") {
      return interaction.reply({ content: helpText(), ephemeral: true });
    }

    if (interaction.commandName === "panel") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("role1")
          .setLabel("Get Role")
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({
        content: "🎛 Reaction Role Panel",
        components: [row]
      });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === "role1") {
      const role = interaction.guild.roles.cache.first();
      if (!role) {
        return interaction.reply({ content: "No role found", ephemeral: true });
      }

      await interaction.member.roles.add(role);
      return interaction.reply({ content: "✅ Role added", ephemeral: true });
    }
  }
});

// ================= GUILD EVENTS =================
function log(guild, text) {
  if (!LOG_CHANNEL_ID) return;
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (ch) ch.send(text);
}

client.on("guildMemberAdd", member => {
  log(member.guild, `👋 Joined: ${member.user.tag}`);
});

client.on("guildMemberRemove", member => {
  log(member.guild, `👋 Left: ${member.user.tag}`);
});

// ================= READY =================
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ================= START =================
if (!TOKEN || !CLIENT_ID) {
  console.log("❌ Missing TOKEN or CLIENT_ID");
} else {
  client.login(TOKEN);
}