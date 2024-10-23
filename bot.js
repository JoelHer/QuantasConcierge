// Require the necessary discord.js classes
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');
const { verifySettingsJson } = require('./utility/dbHelper');
const { settingsTemplate } = require('./commands/general/settings.json');

if (!verifySettingsJson(settingsTemplate)){
	console.log("Invalid settings.json file.");
	process.exit(1);
}

// Create a new client instance
const client = new Client({ 
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Required for reading message content
	] 
});

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);


// Require the necessary libs for the database
const sqlite3 = require('sqlite3').verbose();

// Connect to a SQLite database (it creates the database file if it doesn't exist)
const db = new sqlite3.Database('mydatabase.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

db.run(`CREATE TABLE IF NOT EXISTS guilds (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	guildid TEXT NOT NULL
)`);
<<<<<<< Updated upstream
=======

db.run(`CREATE TABLE IF NOT EXISTS events (
	uuid TEXT PRIMARY KEY,
	guildid TEXT NOT NULL,
	timestamp INTEGER NOT NULL,
	FOREIGN KEY(guildid) REFERENCES guilds(id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS announcements (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	guildid TEXT NOT NULL,
	messageid TEXT NOT NULL,
	FOREIGN KEY(guildid) REFERENCES guilds(id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS jobs (
	jobid INTEGER PRIMARY KEY AUTOINCREMENT,
	eventid TEXT NOT NULL,
	userid TEXT,
	guildid TEXT NOT NULL,
	timestamp INTEGER NOT NULL,
	FOREIGN KEY(guildid) REFERENCES guilds(id),
	FOREIGN KEY(eventid) REFERENCES events(uuid)
)`);
>>>>>>> Stashed changes
  
db.run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY(id) REFERENCES guilds(id),
    UNIQUE(id, key)
)`);

// Export the db instance
module.exports.db = db;


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

// Login to Discord with your client's token
client.login(token);
module.exports.client = client;