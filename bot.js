// Require the necessary discord.js classes
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');
// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

// Register Commands in the ./commands dir
for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Register discord events in the ./events dir
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

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



// Login to Discord with your client's token
client.login(token);
