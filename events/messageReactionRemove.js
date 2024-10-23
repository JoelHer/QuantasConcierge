const { Events } = require('discord.js');
const { db } = require('../bot');
module.exports = {
	name: Events.MessageReactionRemove,
	async execute(reaction, user) {
		if (!user.bot) {
            console.log(`${user.tag} removed their ${reaction.emoji.name} reaction`);
            // check if there is a event, announcemnt in the database
            // if so, remove the user's jobs on that event id

            
        }
	},
};
