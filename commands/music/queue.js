const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current music queue"),
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const queue = interaction.client.player.nodes.get(interaction.guild.id);
    if (!queue || !queue.node.isPlaying()) {
      return interaction.editReply("⚠️ No music is currently playing.");
    }

    const current = queue.currentTrack;
    const tracks = queue.tracks.toArray();

    let response = `🎶 **Now Playing:** ${current.title}\n`;

    if (tracks.length > 0) {
      response += `\n📜 **Up Next:**\n`;
      for (let i = 0; i < Math.min(tracks.length, 10); i++) {
        response += `${i + 1}. ${tracks[i].title}\n`;
      }

      if (tracks.length > 10) {
        response += `...and ${tracks.length - 10} more`;
      }
    } else {
      response += `\n🚫 No more songs in the queue.`;
    }

    await interaction.editReply(response);
  },
};