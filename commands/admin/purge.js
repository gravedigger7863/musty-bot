const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete messages in this channel (max 100)')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');

    // Interaction is already deferred by event handler

    // Check if channel is text-based
    if (!interaction.channel || !interaction.channel.isTextBased()) {
      return interaction.editReply('❌ Cannot purge messages here.');
    }

    // Check bot permissions
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.editReply('❌ I need Manage Messages permission!');
    }

    // Validate amount
    if (amount < 1 || amount > 100) {
      return interaction.editReply('❌ Amount must be between 1 and 100.');
    }

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.editReply(`✅ Deleted ${deleted.size} messages.`);
    } catch (error) {
      console.error(error);
      await interaction.editReply('❌ Failed to delete messages. Messages older than 14 days cannot be deleted.');
    }
  },
};
