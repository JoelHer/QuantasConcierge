const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('post-job')
		.setDescription('Post a job in this channel.')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Title of the post')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description of the post')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emoji-reacts')
                .setDescription('Add emojis for reactions')
                .setRequired(true)),
    async execute(interaction) {
		await interaction.reply('Not implemented.');
	},
};
