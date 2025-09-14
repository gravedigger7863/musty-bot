const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused track'),
  async execute(interaction, client) {
    // Interaction is already deferred by interactionCreate event

    const player = client.manager.players.get(interaction.guild.id);

    if (!player) {
      return interaction.editReply({ content: "❌ No active queue in this server." });
    }

    if (!player.queue.current) {
      return interaction.editReply({ content: "❌ No track is currently playing." });
    }

    if (!player.paused) {
      return interaction.editReply({ content: '▶️ Player is already playing.' });
    }

    player.pause(false);
    return interaction.editReply("▶️ Resumed playback!");
  },
};
