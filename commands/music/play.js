const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from YouTube, Spotify, SoundCloud, and more!")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("Song name, artist, or URL")
        .setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) return interaction.editReply("⚠️ You need to join a voice channel first!");
    if (!interaction.client.player) return interaction.editReply("⏳ Music system not ready yet, try again later.");

    try {
      console.log(`[Play Command] Searching for: ${query}`);
      const searchResult = await interaction.client.player.search(query, { requestedBy: interaction.user });

      if (!searchResult || !searchResult.tracks.length) return interaction.editReply("❌ No tracks found.");

      const track = searchResult.tracks[0];
      console.log(`[Play Command] Found track: ${track.title} by ${track.author}`);

      // Get or create queue
      let queue = interaction.client.player.nodes.get(interaction.guild.id);
      if (!queue) {
        console.log(`[Play Command] Creating new queue`);
        queue = interaction.client.player.nodes.create(interaction.guild, {
          metadata: { channel: interaction.channel },
          selfDeaf: false,
          selfMute: false,
        });
      }

      // Connect to voice channel if not already connected
      if (!queue.connection) {
        console.log(`[Play Command] Connecting to voice channel: ${voiceChannel.name}`);
        await queue.connect(voiceChannel);
        console.log(`[Play Command] Connected, waiting briefly before playing...`);

        // Small delay to ensure connection is ready
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Add track to queue
      queue.addTrack(track);
      console.log(`[Play Command] Track added, queue size: ${queue.tracks.size}`);

      // Play track if not already playing
      if (!queue.isPlaying()) {
        console.log(`[Play Command] About to start playback for: ${track.title}`);
        await queue.node.play(track);
        console.log(`[Play Command] Playback started for: ${track.title}`);
        await interaction.editReply(`🎶 Starting playback...`);
      } else {
        await interaction.editReply(`🎵 **${track.title}** added to the queue (position ${queue.tracks.size})`);
      }
    } catch (err) {
      console.error(`[Play Command] Error:`, err);
      return interaction.editReply(`❌ Failed to play music: ${err.message || "Unknown error"}`);
    }
  },
};