// Track processed interactions to prevent double processing
const processedInteractions = new Set();

// Track command executions to prevent duplicates
const commandExecutions = new Set();

// Safety check to prevent duplicate listener registration
let listenerRegistered = false;

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // BULLETPROOF: Check if interaction already handled - MUST be first line
    if (interaction.handled || interaction.isHandled) {
      console.log('Interaction already handled, skipping:', interaction.id);
      return;
    }
    
    // Mark interaction as being handled IMMEDIATELY - before any other logic
    interaction.handled = true;
    interaction.isHandled = true;
    
    console.log('interactionCreate listener loaded and executing');
    
    // Check if this interaction was already processed
    if (processedInteractions.has(interaction.id)) {
      console.log('Interaction already processed, skipping:', interaction.id);
      return;
    }

    // Check if interaction is still valid (within 2.5 seconds)
    const interactionAge = Date.now() - interaction.createdTimestamp;
    if (interactionAge > 2000) { // 2 seconds safety margin
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

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        processedInteractions.delete(interaction.id);
        return;
      }

      // CRITICAL: Check for duplicate command execution
      const executionKey = `${interaction.id}-${interaction.commandName}`;
      if (commandExecutions.has(executionKey)) {
        console.log(`[InteractionCreate] Duplicate command execution detected, skipping: ${executionKey}`);
        processedInteractions.delete(interaction.id);
        return;
      }
      
      // Mark command as being executed
      commandExecutions.add(executionKey);

      // Defer is now handled in individual commands

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Command execution error:', error);
        
        // Defensive error handling for interaction timeouts
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: '❌ Command failed due to a timeout or error. Please try again.', 
              ephemeral: true 
            });
          } else if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ 
              content: '❌ Command failed due to an error. Please try again.' 
            });
          }
        } catch (replyError) {
          console.error('Failed to send error response:', replyError);
        }
      } finally {
        // Clean up after processing
        processedInteractions.delete(interaction.id);
        commandExecutions.delete(executionKey);
        
        // Clean up old command executions (keep only last 1000)
        if (commandExecutions.size > 1000) {
          const toDelete = Array.from(commandExecutions).slice(0, 100);
          toDelete.forEach(key => commandExecutions.delete(key));
        }
      }
    }
    // Handle button interactions
    else if (interaction.isButton()) {
      const queue = client.player.nodes.get(interaction.guild.id);
      if (!queue) {
        try {
          await interaction.reply({ content: '⚠️ No music is playing.', flags: 64 });
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
              flags: 64
            });
            break;
          case 'skip':
            queue.node.skip();
            await interaction.reply({
              content: '⏭️ Skipped',
              flags: 64
            });
            break;
          case 'stop':
            queue.delete();
            await interaction.reply({
              content: '🛑 Stopped',
              flags: 64
            });
            break;
          case 'volup':
            queue.node.setVolume(Math.min(queue.node.volume + 10, 100));
            await interaction.reply({
              content: `🔊 Volume: ${queue.node.volume}%`,
              flags: 64
            });
            break;
          case 'voldown':
            queue.node.setVolume(Math.max(queue.node.volume - 10, 0));
            await interaction.reply({
              content: `🔉 Volume: ${queue.node.volume}%`,
              flags: 64
            });
            break;
          case 'loop':
            queue.setRepeatMode(queue.repeatMode === 0 ? 1 : 0);
            await interaction.reply({
              content: queue.repeatMode === 1 ? '🔁 Looping current track' : 'Loop disabled',
              flags: 64
            });
            break;
          case 'autoplay':
            queue.node.setAutoplay(!queue.node.isAutoplay);
            await interaction.reply({
              content: queue.node.isAutoplay ? '▶️ Autoplay Enabled' : 'Autoplay Disabled',
              flags: 64
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
              flags: 64
            });
            break;
          default:
            await interaction.reply({ content: '❌ Unknown button interaction', flags: 64 });
        }
      } catch (error) {
        console.error('Button interaction error:', error);
        try {
          await interaction.reply({ content: '❌ Error processing button interaction', flags: 64 });
        } catch (replyError) {
          console.error('Failed to reply to button error:', replyError);
        }
      } finally {
        // Clean up after processing
        processedInteractions.delete(interaction.id);
      }
    } else {
      // Unknown interaction type, clean up
      processedInteractions.delete(interaction.id);
    }
  },
};
