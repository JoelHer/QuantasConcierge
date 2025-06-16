const { SlashCommandBuilder } = require('discord.js');
const { handleTouringCommand } = require('./touring-helper');
const StarCitizenLocation = require('../../utility/data/location');
const locationData = new StarCitizenLocation();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('request-pickup')
		.setDescription('Request a pickup if you are stranded. Don\'t mention the location in notes')
        .addStringOption(option =>
            option.setName('situation')
                .setDescription('What is the current situation you are in?')
                .setRequired(true)
                .addChoices(
                    { name: 'Alive / Healthy', value: 's_healthy' },
                    { name: 'Incapacitated', value: 's_dead' },
                    { name: 'Stuck/Bugged (Explain in notes)', value: 's_stuck' },
                    { name: 'Other (mention in the notes option)', value: 's_other' },
                ))
        .addStringOption(option =>
            option.setName('threat-level')
                .setDescription('How dangerous is your situation?')
                .setRequired(true)
                .addChoices(
                    { name: 'PVP', value: 't_pvp' },
                    { name: 'PVE', value: 't_pve' },
                    { name: 'No threat', value: 't_none' },
                    { name: 'Unknown', value: 't_unknown' },
                ))
        .addStringOption(option =>
			option.setName('rsi-handle')
				.setDescription('Your in-game name, so we can add you')
				.setRequired(true))
        .addStringOption(option =>
            option.setName('notes')
                .setDescription('Additional information?')),
	async execute(interaction) {
		await handleTouringCommand(interaction, "request-pickup");
	},
};
