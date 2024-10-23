const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('upcoming-flights')
		.setDescription('Displays all upcoming flights.'),
	async execute(interaction) {
		await interaction.reply('Upcoming Flights:');
	},
};
