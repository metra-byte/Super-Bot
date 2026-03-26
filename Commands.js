import crypto from "crypto";
import fetch from "node-fetch";
import { API_URL, userTempKeys } from "./index.js";

export const OWNER_IDS = ["1396088469624852540", "1396088469624852540"];

export async function handleCommand(interaction, client) {
  const userId = interaction.user.id;

  // ===== /keygen =====
  if (interaction.commandName === "keygen") {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 4096,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });

    userTempKeys.set(userId, privateKey);

    const dmEmbed = new EmbedBuilder()
      .setTitle("🔑 Temporary RSA Key")
      .setDescription("Use this key for `/login`. Not stored permanently.")
      .addFields(
        { name: "Private Key", value: `\`\`\`pem\n${privateKey}\n\`\`\`` },
        { name: "Public Key", value: `\`\`\`pem\n${publicKey}\n\`\`\`` }
      )
      .setColor(0x00FF00);

    try {
      await interaction.user.send({ embeds: [dmEmbed] });
      await interaction.reply({ content: "✅ Key sent via DM!", ephemeral: true });
    } catch {
      await interaction.reply({ content: "❌ Could not DM you. Open DMs.", ephemeral: true });
    }
  }

  // ===== /login =====
  if (interaction.commandName === "login") {
    const key = interaction.options.getString("key");
    const tempKey = userTempKeys.get(userId);

    if (!tempKey || key !== tempKey) {
      return interaction.reply({ content: "❌ Invalid or expired key.", ephemeral: true });
    }

    // ephemeral login success
    await interaction.reply({ content: "✅ Logged in successfully!", ephemeral: true });

    // Remove ephemeral key
    userTempKeys.delete(userId);
  }

  // ===== /deploy =====
  if (interaction.commandName === "deploy") {
    try {
      const res = await fetch(`${API_URL}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({})
      });
      const data = await res.json();
      await interaction.reply({ content: `🚀 Deployment started! Link: ${data.link}`, ephemeral: true });
    } catch {
      await interaction.reply({ content: "❌ Deployment failed.", ephemeral: true });
    }
  }

  // ===== /run =====
  if (interaction.commandName === "run") {
    const language = interaction.options.getString("language");
    const code = interaction.options.getString("code");

    try {
      const res = await fetch(`${API_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({ language, code })
      });
      const data = await res.json();
      await interaction.reply({ content: `💻 Output:\n\`\`\`\n${data.output}\n\`\`\``, ephemeral: true });
    } catch {
      await interaction.reply({ content: "❌ Execution failed.", ephemeral: true });
    }
  }
}
