const { REST, SlashCommandBuilder, Routes } = require('discord.js');
const { clientID, guildID, token } = require('./config.json');

const commands = [
    new SlashCommandBuilder().setName("create").setDescription("Creates new event")
    .addStringOption(option =>
        option.setName("title").setDescription("The title of the post").setRequired(true))
    .addStringOption(option =>
        option.setName("description").setDescription("The text in the post").setRequired(true))
    .addStringOption(option =>
        option.setName("datetime").setDescription("Set a date and time for the event").setRequired(true)),
    new SlashCommandBuilder().setName("test").setDescription("Test command"),
]
    .map(command => command.toJSON())

const rest = new REST({version: "10"}).setToken(token);

rest.put(Routes.applicationCommands(clientID), { body: commands})
    .then((data) => console.log(`Successfully registered ${data.length} application commands.`))
    .catch(console.error);