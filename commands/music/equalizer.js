const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const LavaPlayerFeatures = require('../../modules/lavaplayer-features');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('equalizer')
    .setDescription('Control the 15-band equalizer (LavaPlayer-inspired)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('preset')
        .setDescription('Apply a preset equalizer configuration')
        .addStringOption(option =>
          option
            .setName('preset')
            .setDescription('Choose an equalizer preset')
            .setRequired(true)
            .addChoices(
              { name: 'Flat', value: 'flat' },
              { name: 'Bass Boost', value: 'bass_boost' },
              { name: 'Treble Boost', value: 'treble_boost' },
              { name: 'Vocal Boost', value: 'vocal_boost' },
              { name: 'Rock', value: 'rock' },
              { name: 'Jazz', value: 'jazz' },
              { name: 'Classical', value: 'classical' },
              { name: 'Electronic', value: 'electronic' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('custom')
        .setDescription('Set custom equalizer values (15 bands)')
        .addStringOption(option =>
          option
            .setName('bands')
            .setDescription('Comma-separated values for 15 bands (e.g., 0,0,0,0,0,0,0,0,0,0,0,0,0.1,0.2,0.3)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reset')
        .setDescription('Reset equalizer to flat (all bands at 0)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Show current equalizer settings')
    ),

  async execute(interaction) {
    const lavaPlayer = new LavaPlayerFeatures();
    
    try {
      await interaction.deferReply();

      const queue = interaction.client.player.nodes.get(interaction.guildId);
      
      if (!queue || !queue.isPlaying()) {
        return interaction.editReply({
          content: '❌ No music is currently playing!'
        });
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'preset') {
        const preset = interaction.options.getString('preset');
        const presets = lavaPlayer.getEqualizerPresets();
        
        if (!presets[preset]) {
          return interaction.editReply({
            content: `❌ Unknown preset: ${preset}`
          });
        }

        const bands = presets[preset];
        lavaPlayer.setEqualizer(interaction.guildId, bands);
        
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🎚️ Equalizer Preset Applied')
          .setDescription(`Applied **${preset.replace('_', ' ')}** preset to the equalizer`)
          .addFields(
            { name: 'Current Track', value: queue.currentTrack.title, inline: true },
            { name: 'Preset', value: preset.replace('_', ' '), inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'custom') {
        const bandsString = interaction.options.getString('bands');
        const bands = bandsString.split(',').map(band => parseFloat(band.trim()));
        
        if (bands.length !== 15) {
          return interaction.editReply({
            content: '❌ You must provide exactly 15 band values separated by commas!'
          });
        }

        // Validate band values
        for (let i = 0; i < bands.length; i++) {
          if (isNaN(bands[i]) || bands[i] < -1 || bands[i] > 1) {
            return interaction.editReply({
              content: `❌ Band ${i + 1} value must be between -1 and 1!`
            });
          }
        }

        lavaPlayer.setEqualizer(interaction.guildId, bands);
        
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🎚️ Custom Equalizer Applied')
          .setDescription('Applied custom equalizer settings')
          .addFields(
            { name: 'Current Track', value: queue.currentTrack.title, inline: true },
            { name: 'Bands', value: bands.map((band, i) => `${i + 1}: ${band.toFixed(2)}`).join('\n'), inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'reset') {
        const flatBands = new Array(15).fill(0);
        lavaPlayer.setEqualizer(interaction.guildId, flatBands);
        
        const embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🎚️ Equalizer Reset')
          .setDescription('Reset equalizer to flat (all bands at 0)')
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'status') {
        const processor = lavaPlayer.getAudioProcessor(interaction.guildId);
        
        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('🎚️ Equalizer Status')
          .setDescription('Current equalizer settings')
          .addFields(
            { name: 'Current Track', value: queue.currentTrack.title, inline: true },
            { name: 'Processing', value: processor.isProcessing ? '✅ Active' : '❌ Inactive', inline: true },
            { name: 'Bands', value: processor.equalizer.map((band, i) => `${i + 1}: ${band.toFixed(2)}`).join('\n'), inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Equalizer command error:', error);
      return interaction.editReply({
        content: '❌ An error occurred while managing the equalizer.'
      });
    }
  },
};
