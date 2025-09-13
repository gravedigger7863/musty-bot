const { SlashCommandBuilder } = require("discord.js");
const { useQueue } = require("discord-player");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current music queue"),
  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.isPlaying()) {
      return interaction.reply("⚠️ No music is currently playing.");
    }

    const current = queue.currentTrack;
    const tracks = queue.tracks.toArray();

    let response = `🎶 **Now Playing:** ${current.title}\n`;

    if (tracks.length > 0) {
      response += `\n📜 **Up Next:**\n`;
      for (let i = 0; i < Math.min(tracks.length, 10); i++) {
        response += `${i + 1}. ${tracks[i].title}\n`;
      }

      if (tracks.length > 10) {
        response += `...and ${tracks.length - 10} more`;
      }
    } else {
      response += `\n🚫 No more songs in the queue.`;
    }

    await interaction.reply(response);
  },
};
