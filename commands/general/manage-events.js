const { SlashCommandBuilder, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, embedLength, ChannelSelectMenuBuilder } = require('discord.js');
const { db } = require('../../bot');
const { getSetting, setSetting, getIdByGuildId } = require('../../utility/dbHelper');
const { renderPublish, renderEventInfo, addPublishMessageComponentsCollector, updatePublicAnnoucementMessage } = require('../../utility/publish');
const { updateManagementMessage } = require('../../utility/jobpost-reaction');
const { checkPermission } = require('../../utility/checkpermission');
const { scheduleEvent } = require('../../utility/eventScheduler');
// this is the query that will be used to get the available seats and the pricing for the event
let tickedAndSeatsQuery = `
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
let maximumSeats = `
    -- Fetch maximum seats, roleid, and rolename if records exist in eventguestrole for the event
    SELECT 
        egr.roleid,
        tr.rolename,
        MAX(egr.seats) AS maxSeats
    FROM 
        eventguestrole egr
    LEFT JOIN 
        ticketroles tr ON egr.roleid = tr.ticketroleid
    WHERE 
        egr.eventid = ?
    GROUP BY 
        egr.roleid, tr.rolename

    UNION ALL
    SELECT 
        1 AS roleid, 
        'normal' AS rolename,              
        25 AS maxSeats                        
    WHERE 
        NOT EXISTS (
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

function dbQuery(query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function renderSelectedEvent(event_uuid) {
    const rows = await dbQuery(`SELECT * FROM events WHERE uuid = ?;`, [event_uuid]);

    var controlRow = new ActionRowBuilder();

    if (!rows || rows.length === 0) {
        console.error('No event found for UUID:', event_uuid);
        return;
    }

    ticketingSeatData = await dbQuery(tickedAndSeatsQuery, [event_uuid, event_uuid, event_uuid]);
    maximumSeatsData = await dbQuery(maximumSeats, [event_uuid, event_uuid]);
    ticketingPricesData = await dbQuery(ticketingPrices, [event_uuid, event_uuid]);

    console.log(ticketingPricesData);

    //merges the two datasets
    const mergedData = ticketingSeatData.map(item => {
        const maxSeatsItem = maximumSeatsData.find(maxItem => maxItem.roleid === item.roleid);
        const priceItem = ticketingPricesData.find(priceItem => priceItem.roleid === item.roleid);
        
        return {
            ...item,
            maxSeats: maxSeatsItem ? maxSeatsItem.maxSeats : null, // Add maxSeats if found, otherwise null
            price: priceItem ? priceItem.price : null, // Add price if found, otherwise null
            rolename: priceItem ? priceItem.rolename : 'normal', // Default to 'normal' if no priceItem found
        };
    });
    

    ticketingSeatString = '';
    ticketingPricesString = '';
    totalSeats = 0;
    totalAvailableSeats = 0;
    mergedData.forEach(ticket => {
        totalSeats += ticket.maxSeats;
        totalAvailableSeats += ticket.availableSeats;
        ticketingSeatString += `- **${(ticket.rolename == "normal")? "Normal":ticket.rolename}**: ${ticket.maxSeats} (${ticket.maxSeats-ticket.availableSeats} reserved)\n`;
        ticketingPricesString += `- **${(ticket.rolename == "normal")? "Normal":ticket.rolename}**: ${(ticket.price > 0)? ticket.price+" aUEC":"Unpurchasable"}\n`;
    });
    publicAnnouncements = await dbQuery(`SELECT * FROM announcements WHERE eventuuid = ? AND type = "PUBLIC_EVENT";`, [event_uuid]);
    employeeAnnouncements = await dbQuery(`SELECT * FROM announcements WHERE eventuuid = ? AND type = "EMPLOYEE_JOBPOST";`, [event_uuid]);
    internalAnnouncements = await dbQuery(`SELECT * FROM announcements WHERE eventuuid = ? AND type = "INTERNAL_EVENTMANAGER";`, [event_uuid]);
    
    const row = rows[0];
    const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(`## Event: ${row.title}`)
        .addFields(
            {
                name: 'Description',
                value: row.description,
                inline: false
            },
            {
                name: 'Length',
                value: row.length || 'Unknown',
                inline: true
            },
            {
                name: 'When?',
                value: `<t:${row.timestamp}:F>`,
                inline: true
            },
            {
                name: 'Ticketing', 
                value: ticketingPricesString,
                inline: true
            },
            {
                name : `Seats (${totalSeats} total, ${totalAvailableSeats} available)`,
                value: ticketingSeatString,
                inline: true
            },
            {
                name: 'Boarding Location',
                value: row.boardinglocation || 'Unknown',
                inline: true
            }
        )
        .addFields(
            {
                name: 'Public announcement Message Link',
                value: (publicAnnouncements[0])? `https://discord.com/channels/${publicAnnouncements[0].guildid}/${publicAnnouncements[0].channelid}/${publicAnnouncements[0].messageid}` : "Not published yet",
                inline: true
            },
            {
                name: 'Updating Management Message Link',
                value: (internalAnnouncements[0])? `https://discord.com/channels/${internalAnnouncements[0].guildid}/${internalAnnouncements[0].channelid}/${internalAnnouncements[0].messageid}` : "Not posted yet. Contact the developer immediately. **This is a bug.**",
                inline: true
            },
            {
                name: 'Internal Job Post Message Link',
                value: (employeeAnnouncements[0])? `https://discord.com/channels/${employeeAnnouncements[0].guildid}/${employeeAnnouncements[0].channelid}/${employeeAnnouncements[0].messageid}` : "Not posted yet. Contact the developer immediately. **This is a bug.**",
                inline: true
            }
        )
        .setFooter({ text: `${event_uuid}; This embed doesn't update automatically.` });

    
    controlRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`back`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`publishevent?uuid=${event_uuid}`)
            .setLabel('Publish')
            .setStyle(ButtonStyle.Success)
            .setDisabled(publicAnnouncements.length > 0),
        new ButtonBuilder()
            .setCustomId(`editevent?uuid=${rows[0].uuid}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Primary),
    );

    return { content: "", embeds: [embed], components: [controlRow], ephemeral: true };
}

// Render the events for interaction responses
async function renderEvents(interaction, events, page = 0) {
    const controlRow = new ActionRowBuilder();

    if (interaction.customId && interaction.customId.startsWith('select_event')) {
        const event_uuid = interaction.values[0].split('=')[1];
        return await renderSelectedEvent(event_uuid);
    } else {
        const eventsPerPage = 2;
        const eventCount = events.length;
        const pagesNeeded = Math.ceil(eventCount / eventsPerPage);
        const splicedEvents = events.slice(page * eventsPerPage, (page + 1) * eventsPerPage);

        let descr = splicedEvents.length === 0
            ? "### No upcoming events to manage."
            : splicedEvents.map(event => 
                `### ${event.title}\n${event.description}\nLength: ? Hours, When? <t:${event.timestamp}:F>\n`
            ).join('');

        const select = new StringSelectMenuBuilder()
            .setCustomId('select_event')
            .setPlaceholder('Make a selection!');

        splicedEvents.forEach(event => {
            select.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(event.title)
                    .setDescription(`Event uuid: ${event.uuid}`)
                    .setValue(`uuid=${event.uuid}`)
            );
        });

        

        const embed = new EmbedBuilder()
            .setColor(0xFFFFFF)
            .setDescription(`## Select upcoming Event:\n${descr}`)
            .setFooter({ text: `Page ${page + 1} of ${pagesNeeded}` });

        const controlRow2 = new ActionRowBuilder();
        if (select.options.length != 0)
            controlRow2.addComponents(select);
            
        controlRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`page_back?page=${page - 1}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`page_next?page=${page + 1}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= pagesNeeded - 1)
        );

        const returnComponents = [controlRow]
        if (controlRow2.components.length != 0)
            returnComponents.push(controlRow2)

        return { embeds: [embed], components: returnComponents, ephemeral: true };
    }
}


// Handle button interactions
async function handleButtonInteraction(interaction, originalMessage) {
    const timestamp = Math.floor(Date.now() / 1000);

    try {
        if (interaction.customId === 'back') {
            const rows = await dbQuery(`SELECT * FROM events WHERE timestamp > ? ORDER BY timestamp ASC;`, [timestamp]);
            await interaction.update(await renderEvents(interaction, rows));
        } else if (interaction.customId.startsWith('select_event')) {
            await interaction.update(await renderEvents(interaction, undefined));
        } else if (interaction.customId.startsWith('page')) {
            const page = parseInt(interaction.customId.split('?')[1].split('=')[1], 10);
            const rows = await dbQuery(`SELECT * FROM events WHERE timestamp > ? ORDER BY timestamp ASC;`, [timestamp]);
            await interaction.update(await renderEvents(interaction, rows, page));
        } else if (interaction.customId.startsWith("publishevent")) {
            const event_uuid = interaction.customId.split('?')[1].split('=')[1]
            const rows = await dbQuery(`SELECT * FROM events WHERE uuid = ?;`, [event_uuid]);
            var location = "";
            if (!rows[0].boardinglocation) {
                const intreply = await interaction.reply({ content: "Please set a location first.", components: [], embeds: [], fetchReply: true, ephemeral: true });
                return;
            } else
                _location = rows[0].boardinglocation;

            let controlRow = new ActionRowBuilder();
            controlRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`cancel`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`confirmpublishevent?uuid=${rows[0].uuid}?location=${_location}`)
                    .setLabel('Publish')
                    .setStyle(ButtonStyle.Success),
            );
            renderedMessage = await renderPublish(db, interaction, rows[0], _location, true);
            renderedMessage.content = "Are you sure you want to publish this event? Please confirm by clicking the button below.";
            renderedMessage.components.push(controlRow);
            let publishMessage;
            try {
                publishMessage = await interaction.editReply(renderedMessage)
            } catch {
                publishMessage = await interaction.update(renderedMessage)
            }
            const publishCollector = publishMessage.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 3_600_000 });
            publishCollector.on('collect', async i => {
                if (i.customId === 'cancel') {
                    await interaction.editReply({ content: 'Event publishing cancelled.', components: [], embeds: [], ephemeral: true });
                } else if (i.customId.startsWith('confirmpublishevent')) {
                    const event_uuid = i.customId.split('?')[1].split('=')[1];
                    const location = i.customId.split('?')[2].split('=')[1];
                    dbQuery(`UPDATE events SET boardinglocation = ? WHERE uuid = ?;`, [location, event_uuid]);
                    const publish = async (selectedChannelId) => {
                        const selectedChannel = interaction.guild.channels.cache.get(selectedChannelId);
                        
                        if (selectedChannel) {
                            const controlRowConfirmSelect = new ActionRowBuilder();
                            controlRowConfirmSelect.addComponents(
                                new ButtonBuilder()
                                .setCustomId(`cancelpublish`)
                                    .setLabel('Cancel')
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId(`confirmpublish`)
                                    .setLabel('Confirm')
                                    .setStyle(ButtonStyle.Success),
                            );
                            
                            await i.deferReply();

                            await i.editReply({
                                content: `Are you sure you want to publish the event in ${selectedChannel.name}?`,
                                ephemeral: true,
                                components: [],
                                embeds: [],
                            });

                            const confirmPublish = await i.editReply({ components: [controlRowConfirmSelect], ephemeral: true });
                            const filter = i => i.user.id === i.user.id;
                            const confirmCollector = confirmPublish.channel.createMessageComponentCollector({ filter: filter, time: 3_600_000 });

                            confirmCollector.on('collect', async i => {
                                if (i.customId === 'cancelpublish') {
                                    confirmCollector.stop();
                                    await i.update({ content: 'Event publishing cancelled.', components: [], embeds: [], ephemeral: true });
                                } else if (i.customId === 'confirmpublish') {
                                    confirmCollector.stop();
                                    await i.update({ content: 'Event published successfully.', components: [], embeds: [], ephemeral: true });
                                    dbQuery('SELECT * FROM events WHERE uuid = ?;', [event_uuid]).then(async _events => {
                                        const publicannounce = await selectedChannel.send(await renderPublish(db, i, rows[0], _events[0].boardinglocation)); // TODO: add signups here AND DB entry for announcements
                                        addPublishMessageComponentsCollector(publicannounce, db);
                                        publicannounce.crosspost().catch(err => {
                                            console.error("Error while crossposting the message: ", err);
                                        });
                                        getSetting(db, i.guild.id, 'boarding_lobby_channel').then(async eventchannel => {
                                            if (eventchannel) {
                                                const channelId = eventchannel.slice(2, -1);
                                                const lobbyChannel = i.guild.channels.cache.get(channelId);
                                                if (lobbyChannel) {
                                                    console.log(lobbyChannel);
                                                    try {
                                                        const messagetosend = await renderEventInfo(db, i, event_uuid);
                                                        const lobbyMessage = await lobbyChannel.send(messagetosend);
                                                        await dbQuery(`INSERT INTO announcements (type, eventuuid, guildid, messageid, channelid) VALUES (?,?,?,?,?);`, ["PUBLIC_EVENT_INFO",event_uuid,i.guild.id,lobbyMessage.id,lobbyChannel.id]);
                                                        scheduleEvent(db, _events[0]);
                                                    } catch (err) {
                                                        console.error("Error while posting info message: ",err);
                                                    }
                                                }
                                            }
                                        })
                                        
                                        await dbQuery(`INSERT INTO announcements (type, eventuuid, guildid, messageid, channelid) VALUES (?,?,?,?,?);`, ["PUBLIC_EVENT",event_uuid,interaction.guild.id,publicannounce.id,selectedChannel.id]);
                                        scheduleEvent(db, _events[0]);
                                    })
                                }
                            })
                            
                        } else {
                            await interaction.editReply({
                                content: "An error occurred. Could not find the selected channel.",
                                ephemeral: true,
                                components: [],
                                embeds: [],
                            });
                        }   
                    }
                    getSetting(db, interaction.guild.id, 'public_event_announcements_channel').then(async eventchannel => {
                        if (eventchannel) {
                            console.log(eventchannel);
                            // remove the <> and # from the channel id#
                            const channelId = eventchannel.slice(2, -1);
                            await publish(channelId);
                        } else {
                            const channelSelectMenu = new ChannelSelectMenuBuilder()
                            .setCustomId('select_channel')
                            .setPlaceholder('Select a channel') 
                            .setMinValues(1)
                            .setMaxValues(1) 
                                .addChannelTypes(ChannelType.GuildText); 
    
                            const actionRow = new ActionRowBuilder().addComponents(channelSelectMenu);
                            channelselect = await interaction.editReply({content: "Where should the event be published? Please select a channel using the dropdown menu below. Discord is sometimes broken with the selection, so you might have to select a different channel first, then select the proper channel.\n**This preference will be saved under settings/management**", ephemeral: true, embeds: [], components: [actionRow]});
                            
                            // use getIdByGuildId to get id

                            getIdByGuildId(db, interaction.guild.id).then(async guildid => {
                                setSetting(db, guildid, 'public_event_announcements_channel', "<#"+channelselect.channelId+">");
                            })
                            

                            const filter = (menuInteraction) => {
                                return menuInteraction.customId === 'select_channel' && menuInteraction.user.id === interaction.user.id;
                            };
                            
                            const menuCollector = interaction.channel.createMessageComponentCollector({
                                time: 60000,
                            });
                            
                            menuCollector.on('collect', async (menuInteraction) => {
                                menuCollector.stop(); 
                                const selectedChannelId = menuInteraction.values[0];
                                await publish(selectedChannelId)
                            });
                        
                            menuCollector.on('end', (collected, reason) => {
                                if (reason === 'time') {
                                    interaction.followUp({
                                        content: "You took too long to respond. Please try again.",
                                        ephemeral: true,
                                    });
                                }
                            });
                        }
                    })


                }
            });
        } else if (interaction.customId.startsWith("editevent")) {
            const uuid = interaction.customId.split('?')[1].split('=')[1];
            const actionRow = new ActionRowBuilder();
            const actionRow2 = new ActionRowBuilder();
            actionRow2.addComponents(
                new ButtonBuilder()
                    .setCustomId(`cancel`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary),
            )
            actionRow.addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('editprop')
                    .setPlaceholder('Select a property to edit')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Description')
                            .setDescription('Edit the description of the event.')
                            .setValue('editprop=description'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Length')
                            .setDescription('Edit the length of the event')
                            .setValue('editprop=length'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('When')
                            .setDescription('Edit the time of the event as a unix timestamp')
                            .setValue('editprop=timestamp'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Location')
                            .setDescription('Edit the Location of the event')
                            .setValue('editprop=location'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Boarding Location')
                            .setDescription('Edit the Boarding Location of the event')
                            .setValue('editprop=boardinglocation'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Ticket Pricing')
                            .setDescription('Edit pricing of tickets')
                            .setValue('editprop=ticket_prices'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Ticket Seats')
                            .setDescription('Edit the number of seats available')
                            .setValue('editprop=ticket_seats')
                    )
            );

            await interaction.update({ components:[actionRow,actionRow2], ephemeral: true });
            const filter = i => i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 3_600_000 });
            collector.on('collect', async i => {
                collector.stop();
                const selectedprop = i.values[0].split('=')[1]
                if (selectedprop === 'description') {
                    i.update({ content: 'Please enter the new description for the event.', components: [], embeds: [], ephemeral: true });
                    const filter = m => m.author.id === interaction.user.id;
                    const collector = i.channel.createMessageCollector({ filter, time: 3_600_000 });
                    collector.on('collect', async i => {
                        collector.stop();
                        i.delete();
                        dbQuery(`UPDATE events SET description = ? WHERE uuid = ?;`, [i.content, uuid]);
                        await interaction.editReply(await renderSelectedEvent(uuid));
                        updatePublicAnnoucementMessage(db, interaction.client, uuid);
                    });
                } else if (selectedprop === 'length') {
                    i.update({ content: 'Please enter the new length for the event in hours.', components: [], embeds: [], ephemeral: true });
                    const filter = m => m.author.id === interaction.user.id;
                    const collector = i.channel.createMessageCollector({ filter, time: 3_600_000 });
                    collector.on('collect', async i => {
                        collector.stop();
                        i.delete();
                        dbQuery(`UPDATE events SET length = ? WHERE uuid = ?;`, [i.content, uuid]);
                        updatePublicAnnoucementMessage(db, interaction.client, uuid);
                        await interaction.editReply(await renderSelectedEvent(uuid));
                    });
                } else if (selectedprop === 'timestamp') {
                    i.update({ content: 'Please enter the new timestamp for the event as a unix timestamp.', components: [], embeds: [], ephemeral: true });
                    const filter = m => m.author.id === interaction.user.id;
                    const collector = i.channel.createMessageCollector({ filter, time: 3_600_000 });
                    collector.on('collect', async i => {
                        collector.stop();
                        i.delete();
                        dbQuery(`UPDATE events SET timestamp = ? WHERE uuid = ?;`, [i.content, uuid]);
                        updatePublicAnnoucementMessage(db, interaction.client, uuid);
                        await interaction.editReply(await renderSelectedEvent(uuid));
                    });
                } else if (selectedprop === 'location') {
                    i.update({ content: 'Please enter the new location for the event.', components: [], embeds: [], ephemeral: true });
                    const filter = m => m.author.id === interaction.user.id;
                    const collector = i.channel.createMessageCollector({ filter, time: 3_600_000 });
                    collector.on('collect', async i => {
                        collector.stop();
                        i.delete();
                        dbQuery(`UPDATE events SET location = ? WHERE uuid = ?;`, [i.content, uuid]);
                        updatePublicAnnoucementMessage(db, interaction.client, uuid);
                        await interaction.editReply(await renderSelectedEvent(uuid));
                    });
                } else if (selectedprop === 'boardinglocation') {
                    i.update({ content: 'Please enter the new boarding location for the event.', components: [], embeds: [], ephemeral: true });
                    const filter = m => m.author.id === interaction.user.id;
                    const collector = i.channel.createMessageCollector({ filter, time: 3_600_000 });
                    collector.on('collect', async i => {
                        collector.stop();
                        i.delete();
                        dbQuery(`UPDATE events SET boardinglocation = ? WHERE uuid = ?;`, [i.content, uuid]);
                        updatePublicAnnoucementMessage(db, interaction.client, uuid);
                        await interaction.editReply(await renderSelectedEvent(uuid));
                    });
                } else if (selectedprop === 'ticket_prices') {
                    const event_uuid = uuid;
                    ticketingSeatData = await dbQuery(tickedAndSeatsQuery, [event_uuid, event_uuid, event_uuid]);
                    maximumSeatsData = await dbQuery(maximumSeats, [event_uuid, event_uuid]);
                    ticketingPricesData = await dbQuery(ticketingPrices, [event_uuid, event_uuid]);

                    console.log(ticketingPricesData);

                    //merges the two datasets
                    const mergedData = ticketingSeatData.map(item => {
                        const maxSeatsItem = maximumSeatsData.find(maxItem => maxItem.roleid === item.roleid);
                        const priceItem = ticketingPricesData.find(priceItem => priceItem.roleid === item.roleid);
                        
                        return {
                            ...item,
                            maxSeats: maxSeatsItem ? maxSeatsItem.maxSeats : null, // Add maxSeats if found, otherwise null
                            price: priceItem ? priceItem.price : null, // Add price if found, otherwise null
                            rolename: priceItem ? priceItem.rolename : 'normal', // Default to 'normal' if no priceItem found
                        };
                    });
                    

                    ticketingSeatString = '';
                    ticketingPricesString = '';
                    totalSeats = 0;
                    totalAvailableSeats = 0;
                    mergedData.forEach(ticket => {
                        totalSeats += ticket.maxSeats;
                        totalAvailableSeats += ticket.availableSeats;
                        ticketingSeatString += `- **${(ticket.rolename == "normal")? "Normal":ticket.rolename}**: ${ticket.maxSeats} (${ticket.maxSeats-ticket.availableSeats} reserved)\n`;
                        ticketingPricesString += `- **${(ticket.rolename == "normal")? "Normal":ticket.rolename}**: ${(ticket.price > 0)? ticket.price+" aUEC":"Unpurchasable"}\n`;
                    });
                    
                    var embed = new EmbedBuilder()
                        .setColor(0xFFFFFF)
                        .setDescription(`## Ticket Prices\nAvailable roles and their prices for the event.\n${ticketingPricesString}`);
                
                    const controlRow = new ActionRowBuilder();
                    //dropdown menu to select ticket to edit the price
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('select_ticket')
                        .setPlaceholder('Select a ticket to edit')

                    mergedData.forEach(tck => {
                        select.addOptions( 
                            new StringSelectMenuOptionBuilder()
                                .setLabel((tck.rolename == "normal")? "Normal":tck.rolename)
                                .setDescription(`Edit the price for the ${tck.rolename} ticket`)
                                .setValue('ticket='+tck.roleid)
                        )
                    })

                    controlRow.addComponents(select);
                    
                    i.update({ components: [controlRow], embeds: [embed], ephemeral: true });
                    const collectorFilter = i => i.user.id === interaction.user.id;
                    const collector = i.channel.createMessageComponentCollector({ filter: collectorFilter, time: 3_600_000 });
                    collector.on('collect', async i => {
                        collector.stop();
                        const selectedticket = i.values[0].split('=')[1];
                        const ticket = mergedData.find(tck => tck.roleid == selectedticket);
                        var _embed = new EmbedBuilder()
                            .setColor(0xFFFFFF)
                            .setDescription(`## Ticket Price\nEdit the price for the ${ticket.rolename} ticket.\nCurrent Price: ${ticket.price} aUEC\nWrite a message with the new price **as an integer**. If you want to make the ticket unpurchasable, write -1.`);
                        i.update({ components: [], embeds: [_embed], ephemeral: true });
                        const msgfilter = m => m.author.id === interaction.user.id;
                        const msgcollector = i.channel.createMessageCollector({ filter: msgfilter, time: 3_600_000 });
                        msgcollector.on('collect', async msg => {
                            msgcollector.stop();
                            await dbQuery(`
                                INSERT INTO eventguestrole (eventid, roleid, price, seats)
                                VALUES (?, ?, ?, ?)
                                ON CONFLICT(eventid, roleid)
                                DO UPDATE SET price = excluded.price, seats = excluded.seats;
                            `, [uuid, selectedticket, msg.content, ticket.maxSeats]);
                            msg.delete();
                            updatePublicAnnoucementMessage(db, interaction.client, uuid);
                            await interaction.editReply(await renderSelectedEvent(uuid));
                        });
                    });
                } else if (selectedprop === 'ticket_seats') {
                    const event_uuid = uuid;
                    ticketingSeatData = await dbQuery(tickedAndSeatsQuery, [event_uuid, event_uuid, event_uuid]);
                    maximumSeatsData = await dbQuery(maximumSeats, [event_uuid, event_uuid]);
                    ticketingPricesData = await dbQuery(ticketingPrices, [event_uuid, event_uuid]);

                    console.log(ticketingPricesData);

                    //merges the two datasets
                    const mergedData = ticketingSeatData.map(item => {
                        const maxSeatsItem = maximumSeatsData.find(maxItem => maxItem.roleid === item.roleid);
                        const priceItem = ticketingPricesData.find(priceItem => priceItem.roleid === item.roleid);
                        
                        return {
                            ...item,
                            maxSeats: maxSeatsItem ? maxSeatsItem.maxSeats : null, // Add maxSeats if found, otherwise null
                            price: priceItem ? priceItem.price : null, // Add price if found, otherwise null
                            rolename: priceItem ? priceItem.rolename : 'normal', // Default to 'normal' if no priceItem found
                        };
                    });
                    

                    ticketingSeatString = '';
                    ticketingPricesString = '';
                    totalSeats = 0;
                    totalAvailableSeats = 0;
                    mergedData.forEach(ticket => {
                        totalSeats += ticket.maxSeats;
                        totalAvailableSeats += ticket.availableSeats;
                        ticketingSeatString += `- **${(ticket.rolename == "normal")? "Normal":ticket.rolename}**: ${ticket.maxSeats} (${ticket.maxSeats-ticket.availableSeats} reserved)\n`;
                        ticketingPricesString += `- **${(ticket.rolename == "normal")? "Normal":ticket.rolename}**: ${(ticket.price > 0)? ticket.price+" aUEC":"Unpurchasable"}\n`;
                    });
                    
                    var embed = new EmbedBuilder()
                        .setColor(0xFFFFFF)
                        .setDescription(`## Ticket Seating\nAvailable seats for the event.\n${ticketingSeatString}`);
                
                    const controlRow = new ActionRowBuilder();
                    //dropdown menu to select ticket to edit the price
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('select_ticket')
                        .setPlaceholder('Select a ticket to edit')

                    mergedData.forEach(tck => {
                        console.log(tck);
                        select.addOptions( 
                            new StringSelectMenuOptionBuilder()
                                .setLabel((tck.rolename == "normal")? "Normal":tck.rolename)
                                .setDescription(`Edit the seats amount for the ${tck.rolename} ticket`)
                                .setValue('ticket='+tck.roleid)
                        )
                    })

                    controlRow.addComponents(select);
                    
                    i.update({ components: [controlRow], embeds: [embed], ephemeral: true });
                    const collectorFilter = i => i.user.id === interaction.user.id;
                    const collector = i.channel.createMessageComponentCollector({ filter: collectorFilter, time: 3_600_000 });
                    collector.on('collect', async i => {
                        collector.stop();
                        const selectedticket = i.values[0].split('=')[1];
                        const ticket = mergedData.find(tck => tck.roleid == selectedticket);
                        var _embed = new EmbedBuilder()
                            .setColor(0xFFFFFF)
                            .setDescription(`## Ticket Seats\nEdit the amount of seats for the ${ticket.rolename} ticket.\nCurrent Seats: ${ticket.maxSeats}\nWrite a message with the new amount of seats **as an integer**.`);
                        i.update({ components: [], embeds: [_embed], ephemeral: true });
                        const msgfilter = m => m.author.id === interaction.user.id;
                        const msgcollector = i.channel.createMessageCollector({ filter: msgfilter, time: 3_600_000 });
                        msgcollector.on('collect', async msg => {
                            msgcollector.stop();

                            await dbQuery(`
                                INSERT INTO eventguestrole (eventid, roleid, price, seats)
                                VALUES (?, ?, COALESCE((SELECT price FROM eventguestrole WHERE eventid = ? AND roleid = ?), 0), ?)
                                ON CONFLICT(eventid, roleid) DO UPDATE SET seats = excluded.seats;
                            `, [uuid, selectedticket, uuid, selectedticket, msg.content]);

                            msg.delete();
                            updatePublicAnnoucementMessage(db, interaction.client, uuid);
                            await interaction.editReply(await renderSelectedEvent(uuid));
                        });
                    });
                }
            })
        }
    } catch (err) {
        console.error('Error handling interaction:', err);
    }
}

function createCollector(message, interaction) {
    const collectorFilter = i => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ filter: collectorFilter, time: 3_600_000 });

    collector.on('collect', async i => {
        try {
            await handleButtonInteraction(i, message);
        } catch (err) {
            console.error('Collector error:', err);
        }
    });
    collector.on('end', collected => {
        console.log(`Collected ${collected.size} interactions.`);
    });
}

// Export the slash command
module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-events')
        .setDescription('Event Management'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const haspermission = await checkPermission(db, interaction.user.id, interaction.guild.id, interaction.client);
        if (!haspermission) {
            return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const rows = await dbQuery(`SELECT * FROM events WHERE timestamp > ? ORDER BY timestamp ASC;`, [timestamp]);

            await interaction.editReply(await renderEvents(interaction, rows));

            const message = await interaction.fetchReply();
            createCollector(message, interaction);
        } catch (err) {
            console.error('Command execution error:', err);
            await interaction.followUp({ content: 'There was an error executing this command.', ephemeral: true });
        }
    },
};
