const { SlashCommandBuilder } = require('discord.js');
const lyricsFinder = require('lyrics-finder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Get lyrics for the current or a specific song')
    .addStringOption(option =>
      option
        .setName('song')
        .setDescription('Song name (leave empty for current track)')
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    let query = interaction.options.getString('song');

    if (!query) {
      const queue = interaction.client.player.nodes.get(interaction.guild.id);
      if (!queue || !queue.currentTrack) {
        return interaction.editReply('⚠️ No song is playing, and you didn\'t provide one.');
      }
      query = queue.currentTrack.title;
    }

    let lyrics = await lyricsFinder("", query) || "❌ Lyrics not found.";
    if (lyrics.length > 4000) {
      lyrics = lyrics.substring(0, 3997) + '...'; // Discord message limit
    }

    return interaction.editReply({
      embeds: [
        {
          color: 0xffd700,
          title: `📜 Lyrics for: ${query}`,
          description: lyrics,
        },
      ],
    });
  },
};