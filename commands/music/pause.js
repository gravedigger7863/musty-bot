const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Toggle pause/resume playback'),
  async execute(interaction, client) {
    // Interaction is already deferred by interactionCreate event

    const queue = client.player.nodes.get(interaction.guild.id);

    if (!queue) {
      return interaction.editReply({ content: "❌ No active queue in this server." });
    }

    if (!queue.currentTrack) {
      return interaction.editReply({ content: "❌ No track is currently playing." });
    }

    const isPaused = queue.node.isPaused();
    queue.node.setPaused(!isPaused);
    
    return interaction.editReply(isPaused ? "▶️ Resumed playback!" : "⏸️ Paused playback!");
  },
};
