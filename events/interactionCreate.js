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

      const errorMessage = { content: '❌ Error while executing command!', flags: 64 };
      
      // Check if interaction is still valid and not already responded to
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ Error while executing command!' }).catch(console.error);
      } else if (!interaction.replied) {
        await interaction.reply(errorMessage).catch(console.error);
      }
    }
  },
};
