const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PlayifyFeatures = require('../../modules/playify-features');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle intelligent autoplay (automatically adds similar songs)')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Enable or disable autoplay')
        .setRequired(true)
        .addChoices(
          { name: 'Enable', value: 'enable' },
          { name: 'Disable', value: 'disable' },
          { name: 'Status', value: 'status' }
        )
    ),

  async execute(interaction) {
    const action = interaction.options.getString('action');
    
    try {
      await interaction.deferReply();

      const queue = interaction.client.player.nodes.get(interaction.guildId);
      
      if (!queue) {
        return interaction.editReply({
          content: '❌ No music is currently playing in this server.'
        });
      }
      
      if (action === 'status') {
        const isEnabled = queue.node.isAutoplay();
        
        const embed = new EmbedBuilder()
          .setColor(isEnabled ? '#00ff00' : '#ff0000')
          .setTitle('🔄 Autoplay Status')
          .setDescription(`Autoplay is currently **${isEnabled ? 'enabled' : 'disabled'}**`)
          .addFields(
            { name: 'What is Autoplay?', value: 'Automatically adds similar songs to the queue when the current track ends.', inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (action === 'enable') {
        queue.node.setAutoplay(true);
        
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🔄 Autoplay Enabled')
          .setDescription('Autoplay is now enabled! The bot will automatically add similar songs to the queue.')
          .addFields(
            { name: 'How it works', value: 'When a track ends, the bot will search for similar songs and add them to the queue.', inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (action === 'disable') {
        queue.node.setAutoplay(false);
        
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('🔄 Autoplay Disabled')
          .setDescription('Autoplay has been disabled.')
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Autoplay command error:', error);
      return interaction.editReply({
        content: '❌ An error occurred while managing autoplay.'
      });
    }
  },
};