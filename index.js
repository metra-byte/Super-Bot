import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import crypto from "crypto";
import fetch from "node-fetch";
import { OWNER_IDS } from "./commands.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: ["CHANNEL"]
});

export const API_URL = process.env.API_URL; // Railway-hosted API
export const userTempKeys = new Map();      // ephemeral keys

// Load command handlers
import("./commands.js").then(({ handleCommand }) => {
  client.on("interactionCreate", async interaction => {
    if (!interaction.isCommand()) return;
    handleCommand(interaction, client);
  });
});

client.login(process.env.TOKEN);
