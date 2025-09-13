const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from Spotify, SoundCloud, Bandcamp, Vimeo, Apple Music, or ReverbNation")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Song name or link")
        .setRequired(true)
    ),
  async execute(interaction) {
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.editReply({ 
        content: "⚠️ You need to join a voice channel first!"
      });
    }

    // Interaction is already deferred by the event handler

    try {
      const queue = interaction.client.player.nodes.create(interaction.guild, {
        metadata: { channel: interaction.channel },
        leaveOnEnd: false,
        leaveOnEmpty: false,
        leaveOnEmptyCooldown: 300000,
      });

      if (!queue.connection) await queue.connect(voiceChannel);

      const result = await queue.play(query, { nodeOptions: { metadata: { channel: interaction.channel } } });
      await interaction.editReply(`🎶 Now playing **${result.track.title}**`);
    } catch (err) {
      console.error(err);
      try {
        await interaction.editReply('❌ No results found for that query or the source is unsupported.');
      } catch (editErr) {
        console.error('Failed to edit reply:', editErr);
        // Try to send a follow-up if edit fails
        try {
          await interaction.followUp({ content: '❌ No results found for that query or the source is unsupported.', flags: 64 });
        } catch (followUpErr) {
          console.error('Failed to send follow-up:', followUpErr);
        }
      }
    }
  },
};
