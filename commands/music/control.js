const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('control')
    .setDescription('Show music control panel in chat'),
  async execute(interaction) {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pause').setLabel('⏯️ Pause/Resume').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('skip').setLabel('⏭️ Skip').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('stop').setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('volup').setLabel('🔊 +').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('voldown').setLabel('🔉 -').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('loop').setLabel('🔁 Loop').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('autoplay').setLabel('▶️ Autoplay').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('queue').setLabel('📜 Queue').setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: '🎶 **Music Control Panel**',
      components: [row1, row2],
    });
  },
};
