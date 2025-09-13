// Track processed interactions to prevent double processing
const processedInteractions = new Set();

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    // Check if this interaction was already processed
    if (processedInteractions.has(interaction.id)) {
      console.log('Interaction already processed, skipping:', interaction.id);
      return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Check if interaction is still valid (within 3 seconds)
    const interactionAge = Date.now() - interaction.createdTimestamp;
    if (interactionAge > 2500) { // 2.5 seconds safety margin
      console.log('Interaction too old, skipping:', interaction.id, 'age:', interactionAge + 'ms');
      return;
    }

    // Mark interaction as being processed
    processedInteractions.add(interaction.id);

    // Clean up old processed interactions (keep only last 1000)
    if (processedInteractions.size > 1000) {
      const toDelete = Array.from(processedInteractions).slice(0, 100);
      toDelete.forEach(id => processedInteractions.delete(id));
    }

    // Immediately defer reply to prevent timeout with better error handling
    try {
      await interaction.deferReply({ flags: 0 });
    } catch (deferError) {
      console.error('Failed to defer interaction:', deferError);
      
      // If defer fails, try to respond immediately
      try {
        await interaction.reply({ 
          content: '⏳ Processing your request...', 
          flags: 64 // Use flags instead of ephemeral
        });
      } catch (replyError) {
        console.error('Failed to reply to interaction:', replyError);
        processedInteractions.delete(interaction.id);
        return;
      }
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
    } finally {
      // Clean up after processing
      processedInteractions.delete(interaction.id);
    }
  },
};
