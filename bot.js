// Require the necessary discord.js classes
const { Client, GatewayIntentBits} = require('discord.js');
const { token } = require('./config.json');
class event
{
	constructor(title, desc, datetime, token)
	{
		this.title = title;
		this.desc = desc;
		this.datetime = datetime;
		this.token = token;
	}
}
const eventlist = [];

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;
	const { commandName } = interaction;
	if (commandName === "test")
	{
		await interaction.reply("Test complete");
	} 
	else if (commandName === "create")
	{
		var title = interaction.options.getString("title");
		var desc = interaction.options.getString("description");
		var datetime = interaction.options.getString("datetime");
		var token = Math.floor(Math.random()*10000000);
		await interaction.reply(title + '\n' + desc + '\n' + datetime);
		await interaction.reply(token);
		var e = new event(title, desc, datetime, token);
		eventlist[eventlist.length] = e;
	}
});

function sort()
{

}

// Login to Discord with your client's token
client.login(token);
