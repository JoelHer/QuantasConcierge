// Require the necessary discord.js classes
const { Client, GatewayIntentBits} = require('discord.js');
const { token } = require('./config.json');

class crew
{
	constructor(username, role)
	{
		this.username = username;
		this.role = role;
	}
}

class passenger
{
	constructor(username, ticketid)
	{
		this.username = username;
		this.ticketid = ticketid;
	}
}

class event
{
	constructor(title, desc, datetime)
	{
		this.title = title;
		this.desc = desc;
		this.datetime = datetime;
		this.crewmembers = [];
		this.passengers = [];
	}

	addcrew(user)
	{
		this.crewmembers[crewmembers.length] = user;
	}

	addpassenger(user)
	{
		this.passengers[passengers.length] = user;
	}

	returnpassnum()
	{
		return this.passengers.length;
	}
}
const eventlist = [];
var tokencounter = 0;

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
		await interaction.reply(title + '\n' + desc + '\n' + datetime + '\n' + eventlist.length);
		var e = new event(title, desc, datetime);
		eventlist[eventlist.length] = e;
	}
	else if (commandName === "join")
	{
		var token = interaction.options.getInteger("token");
		var role = interaction.options.getString("role");
		var c = new crew();
	}
	else if (commandName === "signup")
	{
		var token = interaction.options.getInteger("token");
		var passnum = eventlist[token].returnpassnum();
		var ticketid = token + "-" + passnum;
		var p = new passenger(interaction.user, ticketid);
		eventlist[token].addpassenger(p);
		await interaction.reply("You have signed up for the event, your ticket reciept is " + ticketid);
	}
});


// Login to Discord with your client's token
client.login(token);
