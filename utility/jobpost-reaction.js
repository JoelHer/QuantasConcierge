module.exports = {
    async handleMessage (client, db, messageId, channel, eventuuid, guildid) {
        console.log("Setting up reaction handlers.")
        try {
            const fetchedMessage = await channel.messages.fetch(messageId);

            if (fetchedMessage) {
                const filter = (reaction, user) => {
                    return !user.bot;
                };
                const collector = fetchedMessage.createReactionCollector({ filter, time: 999999999 });

                collector.on('collect', (reaction, user) => {
                    console.log(`${user.tag} reacted with ${reaction.emoji.name}`);
                    db.run(`INSERT INTO jobs (eventid, userid, guildid, timestamp, role) VALUES (?, ?, ?, ?, ?)`, [eventuuid, user.id, guildid, Math.floor(Date.now() / 1000), reaction.emoji.name], function (err, row) {
                        if (err) {
                            console.error(err.message);
                        } 
                    });
                });
            } else {
                console.log('Message not found');
            }
        } catch (error) {
            console.error('Error fetching message:', error);
        }
    }
}