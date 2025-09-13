module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);

      // Check if interaction has already been replied to or deferred
      const errorMessage = { content: '❌ Error while executing command!', flags: 64 }; // Ephemeral flag
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ Error while executing command!' });
      } else {
        await interaction.reply(errorMessage).catch(console.error);
      }
    }
  },
};
