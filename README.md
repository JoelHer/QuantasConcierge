# Official Documentation for Quantas Concierge 


## Index
- [Introduction](#introduction)
- [Implemented and planned features](#features--planned-features)
- [The Docs](#code-documentation)




## Introduction
Quantas Concierge is a discord bot developed for [Quantas Starlines](https://discord.gg/QwhmvzudjP), an org in the game Star Citizen. This Bot is actively maintained by [iHouqLF](https://github.com/JoelHer). It's role is to create, manage and announce events for the employees and guests by the management.

This bot is build on [discord.js](https://discord.js.org/) and uses the internal database [sqlite](https://www.sqlite.org/)


## Features / Planned Features 
- ✔ Creating events in ⁠💼job-board including signup options for crew
- Creating public events in ⁠📆event-announcements including booking options (and possibly payment system?) for passengers
- Display upcoming regular flights
- Booking system for these flights
- Requesting taxi flight/VIP transport
- Requesting pickup (multiple variations; stranded but safe, stranded but in danger, stranded in hostile area (hostile NPC/player ships))

These are subject to change.


## Code Documentation
### Project Structure

\- [bot.js](#botjs-main-file) (main file) <br>
\- [config.json](#configjson) (config for client login) <br>
\- [deploy-commands.js](#deploy-commandsjs) (script for deploying and updating commands) <br>
\- [commands](#slash-commands) (directory for the commands) <br>
\- [events](#event-handling) (directory for the different events) <br>
\- [utility](#utility-directory) (shared functions) <br>

### config.json
This json file, located in the root directory of the project includes login info for the bot to run and update/deploy the slash commands. You won't be able to run the bot without this file. If the file does not exist, create the file with the following content:
```json
{
	"token": "your-token-goes-here",
	"clientId": "your-application-id-goes-here",
	"guildId": "your-server-id-goes-here"
}
```
**token**: Your discord's bot token, created in the [dev portal](https://discord.com/developers/)<br>
**clientId**: Your application-ID that can be found on the [dev portal](https://discord.com/developers/)<br>
**guildId**: A server-ID the bot is on to deploy and update the commands. 

### bot.js (Main file)
The bot.js file is the main code for the bot. From here, the slash commands and events are registered. It registers all events from the /events directory and all shalsh commands from the /commands directory.

At this point in time, this file creates the database tables. In the future, this will be migrated to [/utility/dbHelper.js](#utility-directory). New tables can be created like this:
```js
db.run(`CREATE TABLE IF NOT EXISTS guilds (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	guildid TEXT NOT NULL
)`);
```
The tables will only be created if they don't exist. Meaning, if you change a table in the code, it won't update until that table is deleted. At the moment, you can only update the the tables by deleting the database.

The Code also reads the content of the /events and /commands directories. For the events, it lets discord.js emit the events to the appropriate files. For the commands, it reads the "data" property and the "execute" function. To learn more, read the [slash commands](#slash-commands) section

After logging in, The bot will fetch all announcements from the database and create reaction collectors. The logic for what happends with this data is in [./utility/jobpost-reaction](#utility-directory)

### deploy-commands.js
This script deploys or updates commands. It automatically detects he commands in the /commands directory and reads the data property. To learn more about commands read the [Slash commands](#slash-commands) section.

### Slash commands
All slash commands are stored in the /commands folder. When creating a command create a file and insert the following content:
```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('example')
		.setDescription('Example description')
	async execute(interaction) {
		await interaction.reply('Hello!');
	},
}
``` 
Every commands needs at least the data property and execute function. These are automatically loaded by the main file into the bot when running it. When creating a new command or updating the options of a command run the deploy-commands.js file or run ```npm run deploy```.

Generally, when creating commands, and you need functions that you will use in both the bot and the main file, create this functions in the [/utility](#utility-directory) directory, to prevent circular imports.

### Event handling
Similar to the [slash commands](#slash-commands), the events are also automatically loaded from the main file. To create a new discord bot event handler, create a file in /events with the name of the event, and insert this code:
```js
const { Events } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
	},
};
```
The name and execute are required. the once option is only for this example, because the ClientReady event is only executed once.

### Utility Directory
The utility directory stores general functions used in commands, in the main file or some other place. Generally it **should not** import anything from the main file, or other files like the ```client``` or ```db``` property, to prevent circular imports