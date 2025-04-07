const schedule = require('node-schedule');

function getUpcomingEvents(db) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM events
            WHERE timestamp > ?
            ORDER BY timestamp ASC
        `;
        db.all(query, [Date.now()/1000], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function markReminderSent(db, uuid, type) {
    const column = type === '12hr' ? 'sent_12hr' : 'sent_start';
    const query = `UPDATE events SET ${column} = 1 WHERE uuid = ?`;

    return new Promise((resolve, reject) => {
        db.run(query, [uuid], function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}


module.exports = {
    scheduleEvent(db, event) {
        const eventTime1hr = new Date(event.timestamp*1000 - 60 * 60 * 1000);
        const reminder12hrTime = new Date(event.timestamp*1000 - 18 * 60 * 60 * 1000);
    
        // Schedule 12-hour reminder
        if (!event.sent_12hr && reminder12hrTime > Date.now()) {
            console.log(`Scheduling 18-hour reminder for event: ${reminder12hrTime}`);
            schedule.scheduleJob(reminder12hrTime, async () => {
                console.log(`18-hour reminder for event: ${event.uuid}`);
                getSetting(db, event.guildid, 'event_reminder_channel').then(channelId => {
                    getSetting(db, event.guildid, 'passenger-role').then(passroleid => {
                        if (passroleids) {
                            sole.log(`Sending event start reminder to channel: ${channelId}`);
                            //remove <# and >
                            channelId = channelId.toString().slice(2, -1);
                            client.channels.fetch(channelId).then(channel => {
                                channel.send(`${passroleid} 18-hour reminder for ${event.title} starting in <t:${event.timestamp}:R>!`);
                                markReminderSent(db, event.uuid, '12hr');
                            });
                        } else {
                            console.log(`Sending event start reminder to channel: ${channelId}`);
                            //remove <# and >
                            channelId = channelId.toString().slice(2, -1);
                            client.channels.fetch(channelId).then(channel => {
                                channel.send(`18-hour reminder for ${event.title} starting in <t:${event.timestamp}:R>!`);
                                markReminderSent(db, event.uuid, '12hr');
                            });
                        }
                    })
    
                    getSetting(db, event.guildid, 'employee-role').then(roleid => {
                        if (roleid) {
                            getSetting(db, event.guildid, 'employee_reminder_channel').then(employeereminderchannel => {
                                if (employeereminderchannel) {
                                    console.log(`Sending event start reminder to channel: ${channelId}`);
                                    employeereminderchannel = employeereminderchannel.toString().slice(2, -1);
                                    client.channels.fetch(employeereminderchannel).then(channel => {
                                        channel.send(`${roleid} 18-hour reminder for ${event.title} starting in <t:${event.timestamp}:R>!`);
                                        markReminderSent(db, event.uuid, '12hr');
                                    });
                                } else {
                                    console.log(`Sending event start reminder to channel: ${channelId}`);
                                    channelId = channelId.toString().slice(2, -1);
                                    client.channels.fetch(channelId).then(channel => {
                                        channel.send(`${roleid} 18-hour reminder for ${event.title} starting in <t:${event.timestamp}:R>!`);
                                        markReminderSent(db, event.uuid, '12hr');
                                    });
                                }
                            })
                        }
                    });
                });
            });
        }
    
        // Schedule event start reminder
        if (!event.sent_start && eventTime1hr > Date.now()) {
            console.log(`Scheduling event start reminder for event: ${eventTime1hr}`);
            schedule.scheduleJob(eventTime1hr, async () => {
                console.log(`Event starting in one Hour: ${event.uuid}`);
                //get the "event_remider_channel" setting and send a reminder to that channel
                getSetting(db, event.guildid, 'event_reminder_channel').then(channelId => {
                    getSetting(db, event.guildid, 'passenger-role').then(passroleid => {
                        if (passroleid) {
                            onsole.log(`Sending event start reminder to channel: ${channelId}`);
                            //remove <# and >
                            channelId = channelId.toString().slice(2, -1);
                            client.channels.fetch(channelId).then(channel => {
                                channel.send(`${passroleid} 1-hour reminder for ${event.title} starting in <t:${event.timestamp}:R>!`);
                                markReminderSent(db, event.uuid, 'start');
                            });
                        } else {
                            console.log(`Sending event start reminder to channel: ${channelId}`);
                            //remove <# and >
                            channelId = channelId.toString().slice(2, -1);
                            client.channels.fetch(channelId).then(channel => {
                                channel.send(`1-hour reminder for ${event.title} starting in <t:${event.timestamp}:R>!`);
                                markReminderSent(db, event.uuid, 'start');
                            });
                        }
                    })
    
                });
            });
        }
    },
    async loadAndScheduleEvents(db) {
        const events = await getUpcomingEvents(db);
        console.log(`Loaded ${events.length} upcoming events`);
        events.forEach(_event => {
            module.exports.scheduleEvent(db, _event);
        });
    }
}