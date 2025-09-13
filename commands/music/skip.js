const { SlashCommandBuilder } = require("discord.js");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),
  async execute(interaction) {
    // Defer immediately to prevent interaction timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.isPlaying()) {
      return interaction.editReply("⚠️ No music is currently playing.");
    }

    queue.node.skip();
    await interaction.editReply("⏭️ Skipped!");
  },
};
