const processedInteractions = new Set();

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Check if interaction already processed
    if (processedInteractions.has(interaction.id)) {
      console.log('Interaction already processed, skipping:', interaction.id);
      return;
    }

    // Check if interaction is still valid (within 3 seconds)
    const interactionAge = Date.now() - interaction.createdTimestamp;
    if (interactionAge > 3000) {
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

    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          processedInteractions.delete(interaction.id);
          return;
        }

        try {
          await command.execute(interaction);
        } catch (error) {
          console.error('Command execution error:', error);
          
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ 
                content: '❌ Command failed due to an error. Please try again.',
                flags: 64 // Use flags instead of ephemeral
              });
            } else if (interaction.deferred && !interaction.replied) {
              await interaction.editReply({ 
                content: '❌ Command failed due to an error. Please try again.' 
              });
            }
          } catch (replyError) {
            console.error('Failed to send error response:', replyError);
          }
        }
      }
      // Handle button interactions
      else if (interaction.isButton()) {
        const queue = client.player.nodes.get(interaction.guild.id);
        if (!queue) {
        try {
          await interaction.reply({ content: '⚠️ No music is currently playing.', flags: 64 });
        } catch (error) {
          console.error('Failed to reply to button interaction:', error);
        }
          processedInteractions.delete(interaction.id);
          return;
        }

        try {
          switch (interaction.customId) {
            case 'pause':
              queue.node.setPaused(!queue.node.isPaused());
              await interaction.reply({
                content: queue.node.isPaused() ? '⏸️ Paused' : '▶️ Resumed',
                ephemeral: true
              });
              break;
            case 'skip':
              queue.node.skip();
              await interaction.reply({
                content: '⏭️ Skipped',
                ephemeral: true
              });
              break;
            case 'stop':
              queue.delete();
              await interaction.reply({
                content: '🛑 Stopped',
                ephemeral: true
              });
              break;
            case 'volup':
              queue.node.setVolume(Math.min(queue.node.volume + 10, 100));
              await interaction.reply({
                content: `🔊 Volume: ${queue.node.volume}%`,
                ephemeral: true
              });
              break;
            case 'voldown':
              queue.node.setVolume(Math.max(queue.node.volume - 10, 0));
              await interaction.reply({
                content: `🔉 Volume: ${queue.node.volume}%`,
                ephemeral: true
              });
              break;
            case 'loop':
              queue.setRepeatMode(queue.repeatMode === 0 ? 1 : 0);
              await interaction.reply({
                content: queue.repeatMode === 1 ? '🔁 Looping current track' : 'Loop disabled',
                ephemeral: true
              });
              break;
            case 'autoplay':
              queue.node.setAutoplay(!queue.node.isAutoplay);
              await interaction.reply({
                content: queue.node.isAutoplay ? '▶️ Autoplay Enabled' : 'Autoplay Disabled',
                ephemeral: true
              });
              break;
            case 'queue':
              const current = queue.currentTrack;
              const tracks = queue.tracks.toArray();
              let text = `🎶 **Now Playing:** ${current.title}\n`;
              if (tracks.length > 0) {
                text += '\n📜 **Up Next:**\n';
                tracks.slice(0, 10).forEach((t, i) => text += `${i + 1}. ${t.title}\n`);
                if (tracks.length > 10) text += `...and ${tracks.length - 10} more`;
              } else {
                text += '\n🚫 No more songs in the queue.';
              }
              await interaction.reply({
                content: text,
                ephemeral: true
              });
              break;
            default:
              await interaction.reply({ content: '❌ Unknown button interaction', ephemeral: true });
          }
        } catch (error) {
          console.error('Button interaction error:', error);
          try {
            await interaction.reply({ content: '❌ Error processing button interaction', ephemeral: true });
          } catch (replyError) {
            console.error('Failed to reply to button error:', replyError);
          }
        }
      }
    } catch (error) {
      console.error('Error in interactionCreate:', error);
    } finally {
      // Clean up after processing
      processedInteractions.delete(interaction.id);
    }
  },
};