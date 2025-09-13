const { SlashCommandBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube or Spotify")
    .addStringOption(option =>
      option.setName("query").setDescription("Song name or link").setRequired(true)
    ),
  async execute(interaction) {
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply("⚠️ You need to join a voice channel first!");
    }

    const player = useMainPlayer();
    const { track } = await player.play(voiceChannel, query, {
      nodeOptions: {
        metadata: {
          channel: interaction.channel,
        },
      },
    });

    await interaction.reply(`🎶 Now playing **${track.title}**`);
  },
};
