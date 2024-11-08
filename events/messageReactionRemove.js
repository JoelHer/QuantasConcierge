const { Events } = require('discord.js');
const { db } = require('../bot');
const { updateManagementMessage } = require('../commands/utility/post-job');

module.exports = {
	name: Events.MessageReactionRemove,
	async execute(reaction, user) {
		if (!user.bot) {
            console.log(`${user.tag} removed their ${reaction.emoji.name} reaction. MessageID: ${reaction.message.id}, userid ${user.id}`);
            // check if there is a event, announcemnt in the database
            // if so, remove the user's jobs on that event id

            // SELECT jobid FROM jobs JOIN events ON jobs.eventid = events.uuid JOIN announcements ON jobs.eventid = announcements.eventuuid WHERE messageid = 1304377306235797514 AND role = "🧑‍✈️" AND userid = 548863702334439434
       
            db.all(`SELECT jobid, eventid FROM jobs JOIN events ON jobs.eventid = events.uuid JOIN announcements ON jobs.eventid = announcements.eventuuid WHERE messageid = ? AND role = ? AND userid = ?;`, [reaction.message.id, reaction.emoji.name, user.id], async (err, rows) => {
                rows.forEach(row => {
                    db.run("DELETE FROM jobs WHERE jobid = ?;", [row.jobid], function(err) {
                        if (err) {
                            console.error(err.message);
                        } else {
                            updateManagementMessage(row.eventid);
                        }
                    });
                });
            })
        }
	},
};
