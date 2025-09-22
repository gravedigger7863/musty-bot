const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class CommandUtils {
  constructor() {
    this.userCooldowns = new Map(); // User ID -> timestamp
    this.commandCooldowns = {
      play: 3000,      // 3 seconds
      skip: 1000,      // 1 second
      pause: 1000,     // 1 second
      stop: 2000,      // 2 seconds
      volume: 500,     // 0.5 seconds
      queue: 1000,     // 1 second
      lyrics: 2000,    // 2 seconds
      download: 5000,  // 5 seconds
      filter: 1000,    // 1 second
      equalizer: 1000  // 1 second
    };
  }

  // Check if user is on cooldown
  isOnCooldown(userId, commandName) {
    const cooldown = this.commandCooldowns[commandName] || 1000;
    const lastUsed = this.userCooldowns.get(userId);
    
    if (lastUsed && Date.now() - lastUsed < cooldown) {
      return Math.ceil((cooldown - (Date.now() - lastUsed)) / 1000);
    }
    
    return false;
  }

  // Set cooldown for user
  setCooldown(userId, commandName) {
    this.userCooldowns.set(userId, Date.now());
    
    // Clean up old cooldowns
    if (this.userCooldowns.size > 1000) {
      const cutoff = Date.now() - 60000; // 1 minute
      for (const [id, time] of this.userCooldowns.entries()) {
        if (time < cutoff) {
          this.userCooldowns.delete(id);
        }
      }
    }
  }

  // Validate voice channel requirements
  async validateVoiceChannel(interaction) {
    const member = interaction.member;
    
    if (!member.voice.channel) {
      return {
        valid: false,
        error: '❌ You need to be in a voice channel to use this command!'
      };
    }

    const permissions = member.voice.channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(['Connect', 'Speak'])) {
      return {
        valid: false,
        error: '❌ I need **Connect** and **Speak** permissions to join your voice channel!'
      };
    }

    return { valid: true };
  }

  // Validate queue exists
  validateQueue(interaction, requirePlaying = false) {
    const queue = interaction.client.player.nodes.get(interaction.guildId);
    
    if (!queue) {
      return {
        valid: false,
        error: '❌ No music queue found! Use `/play` to start playing music.'
      };
    }

    if (requirePlaying && !queue.isPlaying()) {
      return {
        valid: false,
        error: '❌ No music is currently playing!'
      };
    }

    return { valid: true, queue };
  }

  // Create consistent error embed
  createErrorEmbed(title, description, footer = null) {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle(`❌ ${title}`)
      .setDescription(description)
      .setTimestamp();

    if (footer) {
      embed.setFooter({ text: footer });
    }

    return embed;
  }

  // Create success embed
  createSuccessEmbed(title, description, footer = null) {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle(`✅ ${title}`)
      .setDescription(description)
      .setTimestamp();

    if (footer) {
      embed.setFooter({ text: footer });
    }

    return embed;
  }

  // Create info embed
  createInfoEmbed(title, description, color = '#0099ff', footer = null) {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`ℹ️ ${title}`)
      .setDescription(description)
      .setTimestamp();

    if (footer) {
      embed.setFooter({ text: footer });
    }

    return embed;
  }

  // Create music control buttons
  createMusicControlButtons(queue) {
    const row = new ActionRowBuilder();
    
    // Pause/Resume button
    const pauseButton = new ButtonBuilder()
      .setCustomId('pause')
      .setEmoji(queue?.node?.isPaused() ? '▶️' : '⏸️')
      .setStyle(ButtonStyle.Secondary);

    // Skip button
    const skipButton = new ButtonBuilder()
      .setCustomId('skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary);

    // Stop button
    const stopButton = new ButtonBuilder()
      .setCustomId('stop')
      .setEmoji('🛑')
      .setStyle(ButtonStyle.Danger);

    // Volume up button
    const volUpButton = new ButtonBuilder()
      .setCustomId('volup')
      .setEmoji('🔊')
      .setStyle(ButtonStyle.Secondary);

    // Volume down button
    const volDownButton = new ButtonBuilder()
      .setCustomId('voldown')
      .setEmoji('🔉')
      .setStyle(ButtonStyle.Secondary);

    row.addComponents(pauseButton, skipButton, stopButton, volUpButton, volDownButton);
    
    return row;
  }

  // Create queue control buttons
  createQueueControlButtons(queue) {
    const row = new ActionRowBuilder();
    
    // Loop button
    const loopButton = new ButtonBuilder()
      .setCustomId('loop')
      .setEmoji(queue?.repeatMode === 1 ? '🔁' : '🔂')
      .setStyle(queue?.repeatMode === 1 ? ButtonStyle.Success : ButtonStyle.Secondary);

    // Autoplay button
    const autoplayButton = new ButtonBuilder()
      .setCustomId('autoplay')
      .setEmoji('▶️')
      .setStyle(queue?.node?.isAutoplay ? ButtonStyle.Success : ButtonStyle.Secondary);

    // Queue button
    const queueButton = new ButtonBuilder()
      .setCustomId('queue')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary);

    row.addComponents(loopButton, autoplayButton, queueButton);
    
    return row;
  }

  // Format duration
  formatDuration(ms) {
    if (!ms || ms < 0) return '0:00';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
  }

  // Format time ago
  formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  // Create progress bar
  createProgressBar(current, total, length = 20) {
    if (!total || total <= 0) return '▬'.repeat(length);
    
    const progress = Math.min(current / total, 1);
    const filled = Math.floor(progress * length);
    
    let bar = '';
    for (let i = 0; i < length; i++) {
      if (i < filled) {
        bar += '█';
      } else if (i === filled) {
        bar += '🔘';
      } else {
        bar += '▬';
      }
    }
    
    return bar;
  }

  // Safe defer reply
  async safeDeferReply(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to defer reply:', error);
      return false;
    }
  }

  // Safe edit reply
  async safeEditReply(interaction, options) {
    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply(options);
        return true;
      } else if (!interaction.replied) {
        await interaction.reply(options);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to edit reply:', error);
      return false;
    }
  }

  // Validate volume
  validateVolume(volume) {
    if (isNaN(volume) || volume < 0 || volume > 100) {
      return {
        valid: false,
        error: '❌ Volume must be a number between 0 and 100!'
      };
    }
    return { valid: true };
  }

  // Get track source emoji
  getSourceEmoji(source) {
    const emojis = {
      spotify: '🎵',
      youtube: '📺',
      soundcloud: '☁️',
      apple: '🍎',
      local: '💾'
    };
    return emojis[source] || '🎶';
  }

  // Create track embed
  createTrackEmbed(track, queue = null, title = '🎵 Track Information') {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(title)
      .setDescription(`**[${track.title}](${track.url})**\nby ${track.author}`)
      .setThumbnail(track.thumbnail)
      .addFields(
        { name: 'Duration', value: this.formatDuration(track.durationMS), inline: true },
        { name: 'Source', value: `${this.getSourceEmoji(track.source)} ${track.source.charAt(0).toUpperCase() + track.source.slice(1)}`, inline: true },
        { name: 'Requested by', value: track.requestedBy?.tag || 'Unknown', inline: true }
      )
      .setTimestamp();

    if (queue) {
      const timestamp = queue.node.getTimestamp();
      const current = timestamp?.current?.value || 0;
      const total = track.durationMS || 0;
      
      if (total > 0) {
        const progressBar = this.createProgressBar(current, total);
        const currentTime = this.formatDuration(current);
        const totalTime = this.formatDuration(total);
        
        embed.addFields({
          name: 'Progress',
          value: `${progressBar}\n${currentTime} / ${totalTime}`,
          inline: false
        });
      }
    }

    return embed;
  }
}

module.exports = CommandUtils;
