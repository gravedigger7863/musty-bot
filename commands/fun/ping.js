const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Shows bot latency and other stats'),
  async execute(interaction) {
    // Interaction is already deferred, so we need to edit the reply
    const startTime = Date.now();
    
    // Calculate latency
    const latency = startTime - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor('Random')
      .addFields(
        { name: 'Bot Latency', value: `${latency}ms`, inline: true },
        { name: 'API Latency', value: `${apiLatency}ms`, inline: true },
        { name: 'Guilds', value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: 'Users', value: `${interaction.client.users.cache.size}`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
