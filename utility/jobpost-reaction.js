const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EmbedBuilder } = require('discord.js');


module.exports = {
    async getRolePrices(db, eventId) {
        const sql = `
            SELECT tr.rolename, COALESCE(egr.seats, 0) AS seats, COALESCE(egr.price, 0) AS price
            FROM ticketroles tr LEFT JOIN eventguestrole egr ON tr.ticketroleid = egr.roleid AND egr.eventid = ?
        `;
    
        return new Promise((resolve, reject) => {
            db.all(sql, [eventId], (err, rows) => {
                if (err) {
                    reject(err); // Reject the promise on error
                } else {
                    resolve(rows); // Resolve the promise with the result
                }
            });
        });
    },
    async handleMessage (client, db, messageId, channel, eventuuid, guildid) {
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
                            return;
                        } 
                        module.exports.updateManagementMessage(db, client, eventuuid);
                    });
                });
            } else {
                console.log('Message not found');
            }
        } catch (error) {
            console.error('Error fetching message:', error);
        }
    },
    compileGuestStatus(db, eventuuid) {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM events WHERE uuid = ?', [eventuuid], function (err, evRows) {
                eventRow = evRows[0]
                db.all(`SELECT * FROM guestSignups WHERE eventid = ?`, [eventuuid], function (err, rows) {
                    if (err) {
                        console.error(err.message);
                        reject("Error fetching data from internal database. Please contact the bot owner.");
                        return;
                    }

                    module.exports.getRolePrices(db, eventuuid).then((rolePrices) => {
                        console.log(rolePrices)
                        result = ""
                        capacity = 0

                        rolePrices.forEach((role) => {
                            if (role.seats > 0) {
                                capacity += role.seats
                            }
                        });
                        if (capacity == 0)
                            capacity = 25
                        rows.forEach((row) => {
                            //console.log(row)
                            result += `‎     ‎🟢  <@${row.memberId}>\n`;
                        });
        

                        resolve({
                            "guests": (result == "") ? "No guests have signed up yet." : result,
                            "title": `Participants (${rows.length}/${capacity})`,
                        });
                    });

                })
            })
        })
    },
    compileEmployeeStatus(db, eventuuid) {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM jobs WHERE eventid = ?`, [eventuuid], function (err, rows) {
                if (err) {
                    console.error(err.message);
                    reject("Error fetching data from internal database. Please contact the bot owner.");
                    return;
                }
                
                const roles = {};
                
                rows.forEach((row) => {
                    if (!roles[row.role]) {
                        roles[row.role] = [];
                    }
                    roles[row.role].push(row.userid);
                });

                result = ""

                Object.entries(roles).forEach(entry => {
                    const [key, value] = entry;
                    console.log(key, value);
                    if (key != "❔") {
                        result += key+":\n";
                        value.forEach(valuekey => {
                            var ind = "🟢"
                            try {
                                ind = (roles["❔"].includes(valuekey))? "🟠":"🟢"
                            } catch {

                            }
                            result += `‎     ‎${ind}  <@${valuekey}>\n`;
                        });
                    }
                })
                
                resolve((result == "") ? "No employees have signed up yet." : result);
            });           
        });
        //'<@&1296029870794477639>:\n‎‎ ‎ ‎ ‎ ‎ ‎🟢  <@548863702334439434>\n‎ ‎ ‎ ‎ ‎ ‎🟠  <@548863702334439434>\n‎ ‎ ‎ ‎ ‎ ‎🟢  <@548863702334439434>\n\n<@&1296029937450356746>:\n‎ ‎ ‎ ‎ ‎ ‎🟢  <@548863702334439434>\n‎ ‎ ‎ ‎ ‎ ‎🟢  <@548863702334439434>\n\n<@&1296029968102326293>:\n‎ ‎ ‎ ‎ ‎ ‎🟢  <@548863702334439434>\n\n'
    },
    updateManagementMessage(db, client, eventuuid) {
        db.all(`SELECT * from events join announcements ON announcements.eventuuid = events.uuid WHERE type = "INTERNAL_EVENTMANAGER" and uuid = ?;`, [eventuuid], function (err, row) {
            if (err) {
                console.error(err.message);
            } else {
                row = row[0]
                client.guilds.cache.get(row.guildid).channels.cache.get(row.channelid).messages.fetch(row.messageid).then((msg) =>{
                    module.exports.buildEventManagerMessage(db, eventuuid).then((newEmbed) => {
                        msg.edit(newEmbed)
                    })
                });
            }
        })
    },
    buildEventManagerMessage(db, eventid) {
        //console.log("Building event manager message for event "+eventid);
        return new Promise((resolve, reject) => {
            db.all(`SELECT * from events join announcements ON announcements.eventuuid = events.uuid WHERE uuid = ? LIMIT 1`, [eventid], function (err, row) {
                row = row[0];
                if (err) {
                    console.error(err.message);
                    reject("Error fetching data from internal database. Please contact the bot owner.");
                } else {
                    module.exports.compileEmployeeStatus(db, eventid).then((employees) => {
                        module.exports.compileGuestStatus(db, eventid).then((guests) => {
                            const eventManagementEmbed = new EmbedBuilder()
                                .setColor(0x000dc1)
                                .setTitle('Upcoming Tour: '+row.title)
                                .addFields(
                                    { name: 'Description:', value: row.description, inline: true },
                                    { name: '\u200B', value: '\u200B' },
                                )
                                .addFields(
                                    { name: 'Employees', value: employees, inline: true },
                                    { name: guests.title, value: guests.guests, inline: true },
                                )
                                .setTimestamp()
                                .setFooter({ text: 'This message updates automatically.  Last update' });
                
                                
                            resolve({ embeds: [eventManagementEmbed] })
                        })
                    })
                }
            })
        })
    },
}