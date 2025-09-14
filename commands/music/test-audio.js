const { SlashCommandBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("test-audio")
    .setDescription("Test audio functionality with a simple track"),

  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply("⚠️ You need to join a voice channel first!");
    }

    const player = useMainPlayer();
    if (!player) {
      return interaction.reply("⏳ Music system not ready yet, try again later.");
    }

    await interaction.deferReply();

    try {
      // Test with a simple YouTube track
      const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; // Rick Roll for testing
      console.log(`[Test Audio] Testing with URL: ${testUrl}`);
      
      const searchResult = await player.search(testUrl, { requestedBy: interaction.user });
      if (!searchResult || !searchResult.tracks.length) {
        return interaction.editReply("❌ No tracks found for test.");
      }

      const track = searchResult.tracks[0];
      console.log(`[Test Audio] Found test track: ${track.title}`);
      console.log(`[Test Audio] Track duration: ${track.duration} (${track.durationMS}ms)`);
      console.log(`[Test Audio] Track source: ${track.source}`);

      let queue = player.nodes.get(interaction.guild.id);
      if (!queue) {
        queue = player.nodes.create(voiceChannel, {
          metadata: { channel: interaction.channel },
          leaveOnEnd: true,
          leaveOnEmpty: true,
          leaveOnStop: true,
          selfDeaf: false,
          selfMute: false,
          volume: 50
        });
      }

      if (!queue.connection) {
        console.log(`[Test Audio] Connecting to voice channel: ${voiceChannel.name}`);
        await queue.connect(voiceChannel);
        console.log(`[Test Audio] Voice connection established`);
      }

      queue.addTrack(track);
      
      if (!queue.node.isPlaying()) {
        console.log(`[Test Audio] Starting test playback`);
        await queue.node.play();
        console.log(`[Test Audio] Test playback started`);
      }

      await interaction.editReply(`🎵 **Audio Test Started!**\nPlaying: **${track.title}**\n\nIf you can hear audio, the bot is working correctly!`);

    } catch (error) {
      console.error("[Test Audio] Error:", error);
      await interaction.editReply(`❌ Audio test failed: ${error.message}`);
    }
  },
};
