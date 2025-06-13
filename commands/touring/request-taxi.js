const { SlashCommandBuilder } = require('discord.js');
const { handleTouringCommand } = require('./touring-helper');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('request-taxi')
		.setDescription('Request a taxi to fly you around.')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Where are you currently?')
                .setRequired(true)),
	async execute(interaction) {
		await handleTouringCommand(interaction);
	},
};
