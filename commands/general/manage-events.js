const { SlashCommandBuilder, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, embedLength, ChannelSelectMenuBuilder } = require('discord.js');
const { db } = require('../../bot');
const { getSetting, setSetting, getIdByGuildId } = require('../../utility/dbHelper');
const { renderPublish } = require('../../utility/publish');
// Wrap database queries in Promises
function dbQuery(query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Render the events for interaction responses
async function renderEvents(interaction, events, page = 0) {
    const controlRow = new ActionRowBuilder();

    if (interaction.customId && interaction.customId.startsWith('select_event')) {
        const event_uuid = interaction.values[0].split('=')[1];
        const rows = await dbQuery(`SELECT * FROM events WHERE uuid = ?;`, [event_uuid]);

        if (!rows || rows.length === 0) {
            console.error('No event found for UUID:', event_uuid);
            return;
        }

        const row = rows[0];
        const embed = new EmbedBuilder()
            .setColor(0xFFFFFF)
            .setDescription(`## Event: ${row.title}`)
            .setFooter({ text: `${event_uuid}; This embed doesn't update automatically.` });

        controlRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`back`)
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`publishevent?uuid=${event_uuid}`)
                .setLabel('Publish')
                .setStyle(ButtonStyle.Success),
        );

        return { embeds: [embed], components: [controlRow], ephemeral: true };
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
async function handleButtonInteraction(interaction) {
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
            const intreply = await interaction.update({ content: "Where is the departure location? (e.g. Everus Harbor, Area 18, etc.)", components: [], embeds: [], fetchReply: true });
            const filter = m => m.author.id === interaction.user.id;
            const collector = await intreply.channel.createMessageCollector({ filter: filter, time: 3_600_000 });
            collector.on('collect', async i => {
                let controlRow = new ActionRowBuilder();
                controlRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cancel`)
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`confirmpublishevent?uuid=${rows[0].uuid}?location=${i.content}`)
                        .setLabel('Publish')
                        .setStyle(ButtonStyle.Success),
                );
                renderedMessage = await renderPublish(db, interaction, rows[0], i.content)
                renderedMessage.components.push(controlRow);
                const publishMessage = await interaction.editReply(renderedMessage)
                collector.stop();
                i.delete();
                const publishCollector = publishMessage.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 3_600_000 });
                publishCollector.on('collect', async i => {
                    if (i.customId === 'cancel') {
                        collector.stop();
                        await interaction.editReply({ content: 'Event publishing cancelled.', components: [], embeds: [], ephemeral: true });
                    } else if (i.customId.startsWith('confirmpublishevent')) {
                        const event_uuid = i.customId.split('?')[1].split('=')[1];
                        const location = i.customId.split('?')[2].split('=')[1];
                        dbQuery(`UPDATE events SET location = ? WHERE uuid = ?;`, [location, event_uuid]);
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
                                
                                await interaction.editReply({
                                    content: `Are you sure you want to publish the event in ${selectedChannel.name}?`,
                                    ephemeral: true,
                                    components: [],
                                    embeds: [],
                                });
    
                                const confirmPublish = await interaction.editReply({ components: [controlRowConfirmSelect], ephemeral: true });
                                const filter = i => i.user.id === interaction.user.id;
                                const confirmCollector = confirmPublish.channel.createMessageComponentCollector({ filter: filter, time: 3_600_000 });
    
                                confirmCollector.on('collect', async i => {
                                    if (i.customId === 'cancelpublish') {
                                        confirmCollector.stop();
                                        await interaction.editReply({ content: 'Event publishing cancelled.', components: [], embeds: [], ephemeral: true });
                                    } else if (i.customId === 'confirmpublish') {
                                        confirmCollector.stop();
                                        await interaction.editReply({ content: 'Event published successfully.', components: [], embeds: [], ephemeral: true });
                                        const publicannounce = await selectedChannel.send({ embeds: [publishMessage.embeds[0]] }); // TODO: add signups here AND DB entry for announcements
    
                                        
                                        await dbQuery(`INSERT INTO announcements (type, eventuuid, guildid, messageid, channelid) VALUES (?,?,?,?,?);`, ["PUBLIC_EVENT",event_uuid,interaction.guild.id,publicannounce.id,selectedChannel.id]);
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

                        collector.stop();

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
            });
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
            await handleButtonInteraction(i);
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
