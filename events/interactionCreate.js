const processedInteractions = new Set();
const interactionTimestamps = new Map();

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    const startTime = Date.now();
    const interactionId = interaction.id;
    
    console.log(`[Interaction] Received: ${interactionId} (${interaction.type}) - ${interaction.commandName || interaction.customId || 'unknown'}`);
    
    // Check if interaction already processed
    if (processedInteractions.has(interactionId)) {
      console.log(`[Interaction] Already processed, skipping: ${interactionId}`);
      return;
    }

    // Check if interaction is still valid (within 2.5 seconds for safety)
    const interactionAge = startTime - interaction.createdTimestamp;
    if (interactionAge > 2500) {
      console.log(`[Interaction] Too old, skipping: ${interactionId} (age: ${interactionAge}ms)`);
      return;
    }

    // Store interaction timestamp for debugging
    interactionTimestamps.set(interactionId, startTime);
    
    // Mark interaction as being processed immediately
    processedInteractions.add(interactionId);
    
    // Clean up old processed interactions (keep only last 500)
    if (processedInteractions.size > 500) {
      const toDelete = Array.from(processedInteractions).slice(0, 100);
      toDelete.forEach(id => {
        processedInteractions.delete(id);
        interactionTimestamps.delete(id);
      });
    }

    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          console.log(`[Interaction] Command not found: ${interaction.commandName}`);
          processedInteractions.delete(interactionId);
          return;
        }

        // IMMEDIATELY defer the interaction to prevent timeout
        try {
          const deferStart = Date.now();
          await interaction.deferReply();
          const deferTime = Date.now() - deferStart;
          console.log(`[Interaction] Deferred successfully in ${deferTime}ms: ${interactionId}`);
        } catch (deferError) {
          console.error(`[Interaction] Failed to defer: ${interactionId}`, deferError.message);
          processedInteractions.delete(interactionId);
          return;
        }

        try {
          const execStart = Date.now();
          await command.execute(interaction);
          const execTime = Date.now() - execStart;
          console.log(`[Interaction] Command executed successfully in ${execTime}ms: ${interactionId}`);
        } catch (error) {
          console.error(`[Interaction] Command execution error: ${interactionId}`, error);
          
          try {
            // Check if interaction is still valid
            if (interaction.isRepliable()) {
              if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ 
                  content: '❌ Command failed due to an error. Please try again.' 
                });
                console.log(`[Interaction] Error response sent: ${interactionId}`);
              }
            }
          } catch (replyError) {
            console.error(`[Interaction] Failed to send error response: ${interactionId}`, replyError.message);
          }
        }
      }
      // Handle button interactions
      else if (interaction.isButton()) {
        const queue = client.player.nodes.get(interaction.guild.id);
        if (!queue) {
          try {
            if (interaction.isRepliable()) {
              await interaction.reply({ content: '⚠️ No music is currently playing.', flags: 64 });
            }
          } catch (error) {
            console.error('Failed to reply to button interaction:', error);
          }
          processedInteractions.delete(interaction.id);
          return;
        }

        try {
          // Check if interaction is still valid
          if (!interaction.isRepliable()) {
            console.log('Button interaction is no longer repliable, skipping');
            return;
          }

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
            if (interaction.isRepliable()) {
              await interaction.reply({ content: '❌ Error processing button interaction', flags: 64 });
            }
          } catch (replyError) {
            console.error('Failed to reply to button error:', replyError);
          }
        }
      }
    } catch (error) {
      console.error(`[Interaction] Error in interactionCreate: ${interactionId}`, error);
    } finally {
      // Clean up after processing
      processedInteractions.delete(interactionId);
      interactionTimestamps.delete(interactionId);
      
      const totalTime = Date.now() - startTime;
      console.log(`[Interaction] Completed processing in ${totalTime}ms: ${interactionId}`);
    }
  },
};