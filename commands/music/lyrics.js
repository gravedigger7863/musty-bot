const { SlashCommandBuilder } = require('discord.js');
const lyricsFinder = require('lyrics-finder');
const { useQueue } = require('discord-player');

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
    await interaction.deferReply(); // allows time for lookup

    let query = interaction.options.getString('song');

    // if no song provided, use current playing track
    if (!query) {
      const queue = useQueue(interaction.guild.id);
      if (!queue || !queue.currentTrack) {
        return interaction.editReply('⚠️ No song is playing, and you didn’t provide one.');
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
