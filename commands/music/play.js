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

    console.log(`[Play Command] Processing play command for interaction: ${interaction.id}`);
    console.log(`[Play Command] Query: ${query}, Voice Channel: ${voiceChannel?.name || "None"}`);

    if (!voiceChannel) {
      console.log(`[Play Command] No voice channel found.`);
      return interaction.editReply("⚠️ You need to join a voice channel first!");
    }

    if (!interaction.client.player) {
      console.log(`[Play Command] Discord Player not initialized.`);
      return interaction.editReply("⏳ Music system not ready yet, try again later.");
    }

    try {
      console.log(`[Play Command] Searching for track...`);
      const searchResult = await interaction.client.player.search(query, { requestedBy: interaction.user });

      if (!searchResult || !searchResult.tracks.length) {
        console.log(`[Play Command] No tracks found for query: ${query}`);
        return interaction.editReply("❌ No tracks found for that query.");
      }

      const track = searchResult.tracks[0];
      console.log(`[Play Command] Found track: ${track.title} by ${track.author} (${track.duration}) from ${track.source}`);

      // Get or create queue
      let queue = interaction.client.player.nodes.get(interaction.guild.id);
      if (!queue) {
        console.log(`[Play Command] Creating new queue`);
        queue = interaction.client.player.nodes.create(interaction.guild, {
          metadata: { channel: interaction.channel },
          selfDeaf: false,
          selfMute: false
        });
      } else {
        console.log(`[Play Command] Using existing queue`);
      }

      // Connect to voice channel if not connected
      if (!queue.isConnected()) {
        console.log(`[Play Command] Connecting to voice channel: ${voiceChannel.name}`);
        await queue.connect(voiceChannel);
        console.log(`[Play Command] Voice connection established`);
      } else {
        console.log(`[Play Command] Already connected to a voice channel`);
      }

      // Add track to queue
      queue.addTrack(track);
      console.log(`[Play Command] Track added to queue. Queue size: ${queue.tracks.size}`);

      // Play if not already playing
      if (!queue.isPlaying()) {
        console.log(`[Play Command] Starting playback...`);
        await queue.node.play();
        console.log(`[Play Command] Playback started successfully`);
      } else {
        console.log(`[Play Command] Already playing, track queued`);
      }

      // Log current state
      console.log(`[Play Command] Queue empty: ${queue.tracks.size === 0}`);
      console.log(`[Play Command] Is playing: ${queue.isPlaying()}`);
      console.log(`[Play Command] Current track: ${queue.currentTrack?.title || 'None'}`);

      await interaction.editReply(`🎵 **${track.title}** by ${track.author} added to the queue!`);
    } catch (err) {
      console.error(`[Play Command] Error:`, err);
      return interaction.editReply(`❌ Failed to play music: ${err.message || "Unknown error"}`);
    }
  },
};