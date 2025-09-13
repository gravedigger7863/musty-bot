module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Immediately defer reply to prevent timeout
    try {
      await interaction.deferReply();
    } catch (deferError) {
      console.error('Failed to defer interaction:', deferError);
      return; // Exit if we can't defer
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Command execution error:', error);
      
      try {
        await interaction.editReply({ content: '❌ Error while executing command!' });
      } catch (editError) {
        console.error('Failed to edit reply:', editError);
        // Try follow-up as last resort
        try {
          await interaction.followUp({ content: '❌ Error while executing command!', flags: 64 });
        } catch (followUpError) {
          console.error('Failed to send follow-up:', followUpError);
        }
      }
    }
  },
};
