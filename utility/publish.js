const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonComponent, ButtonBuilder } = require('discord.js');
const { updateManagementMessage } = require('./jobpost-reaction');
const startsWithVowel = str => /^[aeiou]/i.test(str);

async function createChannelWithUserAndRole(guild, channelName, userId, roleId) {
    const everyoneRole = guild.roles.everyone; // '@everyone' role
    const allowedUser = await guild.members.fetch(userId).catch(() => null); // Fetch the user
    const allowedRole = guild.roles.cache.get(roleId); // Get the role

    if (!allowedUser) {
        throw new Error('User not found.');
    }
    if (!allowedRole) {
        throw new Error('Role not found.');
    }

    const permissionOverwrites = [
        {
            id: everyoneRole.id, // Deny access for everyone
            deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
            id: allowedUser.id, // Allow access for the specific user
            allow: [PermissionsBitField.Flags.ViewChannel],
        },
        {
            id: allowedRole.id, // Allow access for the specific role
            allow: [PermissionsBitField.Flags.ViewChannel],
        },
        {
            id: guild.client.user.id, // Allow access for the bot itself
            allow: [PermissionsBitField.Flags.ViewChannel],
        },
    ];

    // Create the channel
    const channel = await guild.channels.create({
        name: channelName,
        type: 0, // '0' for text channels
        permissionOverwrites,
    });

    return channel;
}

function dbQuery(db, query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}


module.exports = {
    getRolePrices(db, eventId) {
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
    async renderEventInfo(db, interaction, uuid_, _isempheral = false) {
        return new Promise((resolve, reject) => {
            dbQuery(db, `SELECT * FROM events WHERE uuid = ?;`, [uuid])
                .then((rows) => {
                    let event = rows[0];
                    const _embed = new EmbedBuilder()
                        .setTitle(event.title)
                        .setColor(0x062d79)
                        .setAuthor({ name: 'Quantas Starlines' })
                        .setDescription(event.description)
                        .addFields(
                            { name: 'Boarding and requirements', value: `Boarding commences at **${event.boardinglocation}** <t:${event.timestamp}:R>.` },
                            { name: 'Duration', value: `${event.length}` },
                        )
                        .setThumbnail(event.imageurl)
                        .setFooter({ text: (_isempheral == false)? 'This message updates automagically. Last updated: ':'Posted: '})
                        .setTimestamp(Date.now());   
                    resolve({ embeds:[_embed], fetchReply: true });
                })
                .catch((err) => reject(err));
        });
    },
    async renderPublish(db, interaction, event, location, preview=false) {
    
        let rolePrices = await module.exports.getRolePrices(db, event.uuid);
    
        let pricingString = "";
    
        rolePrices = rolePrices.filter(role => role.price >= 0);
        rolePrices = rolePrices.filter(role => role.seats > 0);
    
        if (rolePrices.length == 0) 
            pricingString = "Entry to this event is free for all participants.";
        if (rolePrices.length == 1)
            pricingString = `A ticket for this tour ${(rolePrices[0].price == 0)? "is free.":"costs "+rolePrices[0].price+" (" +rolePrices[0].price/1000+"K) aUEC"}\n`;
        if (rolePrices.length > 1) {
            rolePrices.forEach(role =>{
                pricingString += `A${(startsWithVowel(role.rolename)? "n ":" ")+role.rolename} ticket for this tour ${(role.price == 0)? "is free.":"costs "+role.price+" (" +role.price/1000+"K) aUEC"}\n`;
            })
        }
    
        let limitedSeats = ""
        if (rolePrices.length == 0)
            limitedSeats = `Signup is limited to 25 passengers.`;
        if (rolePrices.length == 1)
            limitedSeats = `Signup is limited to ${rolePrices[0].seats} passengers.`;
        if (rolePrices.length > 1) {
            limitedSeats = `Signup is limited to `;
            rolePrices.forEach(role =>{
                if (role == rolePrices[rolePrices.length-1]) {
                    limitedSeats = limitedSeats.slice(0, -2) + " and ";
                } else {
                    
                }
                limitedSeats += `${role.seats} ${role.rolename} passenger${(role.seats == 1)?"":"s"}, `;
                //if its the last eleement add a dot
                if (role == rolePrices[rolePrices.length-1])
                    limitedSeats = limitedSeats.slice(0, -2) + "."
    
            })
        }
        
        limitedSeats += ` Signup closes in <t:${event.timestamp-3600}:R>.`;
    
        const embed = new EmbedBuilder()
            .setTitle(event.title)
            .setColor(0x062d79)
            .setAuthor({ name: 'Quantas Starlines', iconURL: 'https://i.ibb.co/Xxb3FC4/Quantas-Logo-V2-Discord.png' })
            .setDescription(event.description)
            .addFields(
                { 
                    name: 'Boarding and requirements', 
                    value: `Boarding commences at **${location}** on <t:${event.timestamp}:F>.`
                }, 
                {
                    name: "Tickets",
                    value: pricingString
                },
                {
                    name: "How to pay",
                    value: "Once you've signed up using the post, you can open the payment thread."
                },
                {
                    name: "   ",
                    value: limitedSeats
                }
            )
            .setImage(event.imageurl)
            .setFooter({ text: 'Credits to BuildandPlay on Discord for the screenshot.' });
    
        if (!preview) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('signup?uuid='+event.uuid)
                        .setLabel('Signup / Opt out')
                        .setStyle('Primary'),
                );
    
            return { embeds: [embed], components: [row], ephemeral: true, fetchReply: true };
        } else {
            return { embeds: [embed], components: [], ephemeral: true, fetchReply: true };
        }
    },
    async updatePublicAnnoucementMessage(db, client, event_uuid){
        db.all(`SELECT * from events join announcements ON announcements.eventuuid = events.uuid WHERE type = "PUBLIC_EVENT" and uuid = ?;`, [event_uuid], function (err, row) {
            if (err) {
                console.error(err.message);
            } else {
                row = row[0]    
                if (row) {
                    client.guilds.cache.get(row.guildid).channels.cache.get(row.channelid).messages.fetch(row.messageid).then((msg) =>{
                        module.exports.renderPublish(db, null, row, row.location, false).then((newEmbed) => {
                            msg.edit(newEmbed)
                            db.all(`SELECT * from events join announcements ON announcements.eventuuid = events.uuid WHERE type = "PUBLIC_EVENT_INFO" and uuid = ?;`, [event_uuid], function (err, rows) {
                                if (err) {
                                    console.error(err.message);
                                } else {
                                    rows.forEach(row => {
                                        if (row) {
                                            client.guilds.cache.get(row.guildid).channels.cache.get(row.channelid).messages.fetch(row.messageid).then((msg) =>{
                                                module.exports.renderEventInfo(db, null, row.eventuuid).then((newEmbed) => {
                                                    msg.edit(newEmbed)
                                                })
                                            });
                                        }
                                    })
                                }
                            })
                        })
                    });
                }
            }
        })
    },

    async addPublishMessageComponentsCollector(message, db) {
        //console.log("Adding collector for message", message.id);
        const collector = message.createMessageComponentCollector({ time: 999999999 });
        collector.on('collect', async i => {
            collector.resetTimer(); // this may break the collector? nut sure yet.
            if (i.customId.startsWith('signup')) {
                const eventid = i.customId.split('?')[1].split('=')[1];
                db.all(`SELECT * FROM guestSignups WHERE memberId = ? AND eventId = ? AND guildId = ?;`,[i.user.id, eventid, i.guild.id], (err, rows) => {
                    if (err) {
                        console.error(err.message);
                        return;
                    } if (rows.length > 0) {
                        const row = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('optout?uuid='+eventid)
                                    .setLabel('Opt out')
                                    .setStyle('Primary')
                                    .setDisabled(false),
                            );
                        i.reply({ content: 'You have already signed up for this event.', components: [row], ephemeral: true, fetchReply: true }).then((msg) => {
                            const collector = msg.createMessageComponentCollector({ time: 60000 });
                            collector.on('collect', async i => {
                                if (i.customId.startsWith('optout')) {
                                    const eventid = i.customId.split('?')[1].split('=')[1];
                                    db.run(`DELETE FROM guestSignups WHERE memberId = ? AND eventId = ? AND guildId = ?;`,[i.user.id, eventid, i.guild.id], function(err) {
                                        if (err) {
                                            console.error(err.message);
                                        } else {
                                            i.reply({ content: 'You have opted out of the event.', ephemeral: true });
                                            updateManagementMessage(db, i.client, eventid);
                                        }
                                    });
                                }
                            });
                        });
                        return;
                    } else {
                        if (err) {
                            console.error(err.message);
                        } else {
                        /**
                            This query retrieves the available seats for a specific event, 
                            grouped by ticket role (or roleid), while also including the 
                            ticket's name (rolename). The query accounts for the seats that 
                            have already been booked by users (based on the guestSignups 
                            table) and excludes tickets that have a price lower than 0.
                        */

                            let q = `
                                -- First part: If records exist in eventguestrole for the event, get available seats.
                                    SELECT 
                                        egr.roleid,
                                        tr.rolename,
                                        egr.seats - COALESCE(COUNT(gs.ticketRoleId), 0) AS availableSeats
                                    FROM 
                                        eventguestrole egr
                                    LEFT JOIN 
                                        guestSignups gs
                                    ON egr.eventid = gs.eventId AND egr.roleid = gs.ticketRoleId
                                    LEFT JOIN 
                                        ticketroles tr
                                    ON egr.roleid = tr.ticketroleid
                                    WHERE 
                                        egr.eventid = ?  -- Specify event ID
                                    GROUP BY 
                                        egr.eventid, egr.roleid, tr.rolename

                                    UNION ALL

                                    -- Second part: If no records exist in eventguestrole, return fallback ticket with 25 seats, accounting for signups.
                                    SELECT 
                                        1 AS roleid,                           -- Default roleid for "normal" ticket
                                        'normal' AS rolename,                  -- Default rolename for "normal" ticket (lowercase)
                                        25 - COALESCE(COUNT(gs.ticketRoleId), 0) AS availableSeats  -- Subtract the booked seats from 25
                                    FROM 
                                        guestSignups gs
                                    WHERE 
                                        gs.eventId = ?    -- Filter by event ID for signups
                                        AND gs.ticketRoleId = 1                                    -- Ensure it's the "normal" ticket role (roleid = 1)
                                    HAVING 
                                        COUNT(gs.ticketRoleId) < 25  -- Only return this row if there are available seats (less than 25 bookings)

                                    -- Ensure fallback only returns if no roles exist for the event in eventguestrole
                                    AND NOT EXISTS (
                                        SELECT 1
                                        FROM eventguestrole
                                        WHERE eventid = ?
                                    );

                            `

                            let ticketingPrices = `
                                SELECT 
                                    COALESCE(egr.roleid, 1) AS roleid, 
                                    COALESCE(tr.rolename, 'normal') AS rolename, 
                                    COALESCE(egr.price, 0) AS price 
                                FROM 
                                    eventguestrole egr
                                LEFT JOIN 
                                    ticketroles tr ON egr.roleid = tr.ticketroleid
                                WHERE 
                                    egr.eventid = ?
                                UNION ALL
                                SELECT 
                                    1 AS roleid, 
                                    'normal' AS rolename, 
                                    0 AS price
                                WHERE 
                                    NOT EXISTS (
                                        SELECT 1
                                        FROM eventguestrole
                                        WHERE eventid = ?
                                    );
                            `
                            db.all(q, [eventid,eventid,eventid], (err, rows) => {
                                db.all(ticketingPrices, [eventid, eventid], (err, ticketPrices) => {
                                    const mergedData = rows.map(row => {
                                        const price = ticketPrices.find(price => price.roleid === row.roleid);
                                        return { ...row, ...price };
                                    })
                                    console.log("merhedr", mergedData)
                                    const row = new ActionRowBuilder()	
                                    for (x in mergedData) {
                                        if (mergedData[x].price >= 0) {
                                            row.addComponents(
                                                new ButtonBuilder()
                                                    .setCustomId('selectticket?uuid='+eventid+'?tickettype='+rows[x].roleid)
                                                    .setLabel(((rows[x].rolename == "normal")?"Normal":rows[x].rolename)+' ticket')
                                                    .setStyle('Primary')
                                                    .setDisabled((rows[x].availableSeats == 0)?true:false),
                                            );
                                        }
                                    }
                                    const embed = new EmbedBuilder()
                                        .setTitle("Select a ticket")
                                        .setDescription("Please choose a ticket. The payment process will start after selection if the ticket is not free")
                                        .setColor(0x062d79)
    
                                    i.reply({ components: [row], embeds:[embed], ephemeral: true, fetchReply: true }).then((msg) => {
                                        const cllecter = msg.createMessageComponentCollector({ time: 60000 });
                                        cllecter.on('collect', async i => {
                                            cllecter.stop();
                                            if (i.customId.startsWith('selectticket')) {
                                                const eventid = i.customId.split('?')[1].split('=')[1];
                                                const tickettype = i.customId.split('?')[2].split('=')[1];
                                                db.run(`INSERT INTO guestSignups (memberId, eventId, guildId, ticketRoleId, status) VALUES (?, ?, ?, ?, "PAYMENT_PENDING");`,[i.user.id, eventid, i.guild.id, tickettype], function(err) {
                                                    if (err) {
                                                        console.error(err.message);
                                                    } else { 
                                                        //get the ticket price 
                                                        let ticketPrice = ticketPrices.find(price => price.roleid == tickettype).price;
                                                        if (ticketPrice > 0) {
                                                            const actionRow = new ActionRowBuilder()
                                                            var embed = new EmbedBuilder()
                                                                .setTitle("Payment pending")
                                                                .setDescription('You have signed up for the event. Please proceed to the payment thread with the button below to pay.')
                                                                .setColor(0x062d79)
                                                            actionRow.addComponents(
                                                                new ButtonBuilder()
                                                                    .setCustomId('payment?uuid='+eventid)
                                                                    .setLabel('Pay')
                                                                    .setStyle('Success')
                                                            );
                                                            i.reply({ embeds: [embed], components:[actionRow], ephemeral: true, fetchReply: true }).then((msg) => {
                                                                updateManagementMessage(db, i.client, eventid);
                                                                const collector = msg.createMessageComponentCollector({ time: 999999999 });
                                                                collector.on('collect', async i => {
                                                                    if (i.customId.startsWith('payment')) {
                                                                        const eventid = i.customId.split('?')[1].split('=')[1];
                                                                        try {
                                                                            const channel = await createChannelWithUserAndRole(i.guild, "payment-thread_"+i.user.id+"_"+eventid, i.user.id, "1296029870794477639");
                                                                            i.reply({content:`Payment thread created. Please proceed to the channel ${channel} to complete the payment.`, ephemeral: true});
                                                                            var embed = new EmbedBuilder()
                                                                                .setTitle("Payment thread")
                                                                                .setDescription("Welome to the payment thread. Please send "+ticketPrice+" aUEC to the following account: QuantasStarlines and then send an screenshot of the transaction here. \nThe button below will be used by the management to confirm the payment.")
                                                                                .setColor(0x062d79)
                                                                            channel.send({ content: `<@${i.user.id}> <@&${"1296029870794477639"}>`, components: [],embeds:[embed], fetchReply: true }).then((msg) => {
                                                                                db.run(`INSERT INTO announcements (type, eventuuid, guildid, messageid, channelid) VALUES ("PAYMENT_CONFIRMATION",?,?,?,?);`,[eventid, i.guild.id, msg.id, msg.channel.id], function(err) {
                                                                                    if (err) {
                                                                                        console.error(err.message);
                                                                                    } else {
                                                                                        console.log("Payment confirmation message created")
                                                                                    }
                                                                                });
                                                                            });
                                                                        } catch (error) {
                                                                            console.error(error);
                                                                            i.reply({content:`Failed to create channel: ${error.message}`, ephemeral: true});
                                                                        }
                                                                    }
                                                                });
                                                            });
                                                        } else {
                                                            db.run(`UPDATE guestSignups SET status = "CONFIRMED" WHERE memberId = ? AND eventId = ? AND guildId = ?;`,[i.user.id, eventid, i.guild.id], function(err) {
                                                                if (err) {
                                                                    console.error(err.message);
                                                                } else {
                                                                    module.exports.renderEventInfo(db, i, eventid).then((renderEventInfo) => {
                                                                        i.reply({ content: "You have signed up for the event. Because your ticket is free, you don't have to open a payment thread.", embeds:[renderEventInfo.embeds[0]], ephemeral: true });
                                                                        updateManagementMessage(db, i.client, eventid);
                                                                    })
                                                                }
                                                            });
                                                        }
                                                    }
                                                });
                                            }
                                        })
                                    });
                                })
                            });
                        }
                    }
                })
            }
        });
    }
}