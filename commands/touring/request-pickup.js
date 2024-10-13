const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('request-pickup')
		.setDescription('Request a pickup if you are stranded.')
        .addStringOption(option =>
            option.setName('situation')
                .setDescription('What is the current situation you are in?')
                .setRequired(true)
                .addChoices(
                    { name: 'Stranded but safe', value: 's_safe' },
                    { name: 'Stranded but in danger', value: 's_danger' },
                    { name: 'Stranded in hostile area ', value: 's_hostile' },
                    { name: 'Other (please mention it in the notes option)', value: 'other' },
                ))
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Where are you?')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('notes')
                .setDescription('Is there something you want to tell us?')),
	async execute(interaction) {
		await interaction.reply('Not implemented.');
	},
};
