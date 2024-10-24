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
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.MessageContent,
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

db.run(`CREATE TABLE IF NOT EXISTS events (
	uuid TEXT PRIMARY KEY,
	guildid TEXT NOT NULL,
	timestamp INTEGER NOT NULL,
	title TEXT,
	description TEXT,
	imageurl TEXT,
	FOREIGN KEY(guildid) REFERENCES guilds(id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS announcements (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	eventuuid TEXT NOT NULL,
	guildid TEXT NOT NULL,
	messageid TEXT NOT NULL,
	channelid TEXT NOT NULL,
	FOREIGN KEY(eventuuid) REFERENCES events(uuid),
	FOREIGN KEY(guildid) REFERENCES guilds(id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS jobs (
	jobid INTEGER PRIMARY KEY AUTOINCREMENT,
	eventid TEXT NOT NULL,
	userid TEXT,
	guildid TEXT NOT NULL,
	timestamp INTEGER NOT NULL,
	role TEXT,
	FOREIGN KEY(guildid) REFERENCES guilds(id),
	FOREIGN KEY(eventid) REFERENCES events(uuid)
)`);
  
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
client.login(token).then(async () => {
    // Get all announcements that are in the future
    const timestamp = Math.floor(Date.now() / 1000);
    db.all(`SELECT * FROM events JOIN announcements ON events.uuid = announcements.eventuuid WHERE timestamp > ?;`, [timestamp], async (err, rows) => {
        if (err) {
            console.error(err.message);
            return;
        }

        try {
            if (!rows || rows.length === 0) return;

            // Function to handle the fetched message and setup the collector
            const handleMessage = async (messageId, channel, row) => {
                try {
                    const fetchedMessage = await channel.messages.fetch(messageId);

                    if (fetchedMessage) {
                        const filter = (reaction, user) => {
                            return !user.bot;
                        };
                        const collector = fetchedMessage.createReactionCollector({ filter, time: 999999999 });

                        collector.on('collect', (reaction, user) => {
                            console.log(`${user.tag} reacted with ${reaction.emoji.name}`);
							db.run(`INSERT INTO jobs (eventid, userid, guildid, timestamp, role) VALUES (?, ?, ?, ?, ?)`, [row.uuid, user.id, row.guildid, Math.floor(Date.now() / 1000), reaction.emoji.name], function (err, row) {
                                if (err) {
                                    console.error(err.message);
                                } 
                                console.log("Successfully inserted emoji reactio aiojspdi0jiapoüsjd into db.")
                            });
                        });
                    } else {
                        console.log('Message not found');
                    }
                } catch (error) {
                    console.error('Error fetching message:', error);
                }
            };

            for (const row of rows) {
                const messageId = row.messageid; // Assuming your row has a messageId property
                const channelId = row.channelid; // Get the channel ID from the row

                // Fetch the channel using the channelId
                const channel = await client.channels.fetch(channelId);

                // Now call the handleMessage function
                await handleMessage(messageId, channel, row); // Call the async function with await
            }
        } catch (err) {
            console.error(err);
        }
    });
});

module.exports.client = client;