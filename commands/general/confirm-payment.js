const { SlashCommandBuilder } = require('discord.js');
const wait = require('node:timers/promises').setTimeout;
const { db } = require('../../bot');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('confirm-payment')
		.setDescription('Replies with Pong!'),
	async execute(interaction) {
		await interaction.deferReply();
		await wait(2_000);
		await interaction.editReply('Pong!');
	},
};
