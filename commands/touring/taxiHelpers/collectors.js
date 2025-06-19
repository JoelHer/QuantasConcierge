const { EmbedBuilder, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, ButtonComponent } = require('discord.js');

function setupTaxiRequestCollector(_db, client, sentMessageId, voiceChannelId, taxiRequestUserId, channel, taxiRoleId) {
    channel.messages.fetch(sentMessageId).then(sentMessage => {
        var employeeHasAnswered = false;

        const collector = sentMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 600_000 // 10 minutes
        });

        console.log(`TAXI_ACCEPT_STAFF_REQUEST set up for message ${sentMessageId} in channel ${channel.id} for user ${taxiRequestUserId}.`);

        collector.on('collect', async i => {
            const selection = i.customId.split('.')[0]+"."+i.customId.split('.')[1]; // Get the selection from the custom ID
            const requestUUID = i.customId.split('.')[2]; // Extract the request UUID from the custom ID
            // make sure the user that made the interaction, has the taxi role
            if (!i.member.roles.cache.has(taxiRoleId)) {
                const declineMessage = await i.reply({ content: 'You do not have permission to accept or decline taxi requests.', ephemeral: true });
                await new Promise(resolve => setTimeout(resolve, 3000));
                await declineMessage.delete();
                return;
            }
            
            if (selection === `accept.taxi`) {
                employeeHasAnswered = true;
                const acceptEmbed = new EmbedBuilder()
                    .setTitle('Waiting for the user\'s final confirmation... ⏳')
                    .setDescription(`Your taxi request has been accepted by <@${i.user.id}>. Now it's up to <@${taxiRequestUserId}> to confirm the ride.\n\nPlease confirm your taxi request one last time by clicking one of the buttons below:`)
                    .setColor(0x00FF00);
                await i.message.edit({ components: [] });
                
                const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept.taxi.${requestUUID}`)
                        .setLabel('Accept Request')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`decline.taxi.${requestUUID}`)
                        .setLabel('Decline Request')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('✖️')
                );

                const resp = await i.message.channel.send({ embeds: [acceptEmbed], components: [actionRow], withResponse: true, content: `<@${taxiRequestUserId}>` });
                collector.stop(); 
                _db.run(
                    'DELETE FROM taxi_messages WHERE taxiuuid = ? AND guildid = ? AND messageid = ?',
                    [
                        i.customId.split('.')[2], // Extract the request UUID from the custom ID
                        i.guild.id,
                        i.message.id
                    ],
                );
                _db.run(
                    'INSERT INTO taxi_messages (type, taxiuuid, guildid, messageid, channelid) VALUES ("TAXI_ACCEPT_PERSONA_REQUEST", ?, ?, ?, ?)',
                    [
                        i.customId.split('.')[2], // Extract the request UUID from the custom ID
                        i.guild.id,
                        resp.id,
                        i.message.channel.id
                    ],
                );
                setupTaxiRequestPersonaCollector(_db, client, resp.id, voiceChannelId, taxiRequestUserId, channel, taxiRoleId);
            } else if (selection === `decline.taxi`) {
                const declineEmbed = new EmbedBuilder()
                    .setTitle('Taxi Request Unavailable ✖️')
                    .setDescription(`There are currently no employees available. We are sorry, you can try again later.`)
                    .setColor(0xFF0000);
                await i.message.edit({ embeds: [declineEmbed], components: [], content: `<@${i.user.id}>` });
                await i.message.channel.send(`<@${taxiRequestUserId}> Your request has been declined.`);
                collector.stop(); 
                _db.run(
                    'DELETE FROM taxi_messages WHERE taxiuuid = ? AND guildid = ? AND messageid = ?',
                    [
                        i.customId.split('.')[2], // Extract the request UUID from the custom ID
                        i.guild.id,
                        i.message.id
                    ],
                );
            }
        });

        collector.on('end', collected => {
            // edit the message to remove the buttons after the collector ends
            console.log(`Collector ended. Collected ${collected.size} interactions.`);
            if (employeeHasAnswered) return; // If an employee has answered, we don't want to end the request
            _db.run(
                'DELETE FROM taxi_messages WHERE taxiuuid = ? AND guildid = ? AND type = ?',
                [
                    sentMessage.channel.name.replace(/^taxi-/, ''), // Extract the request UUID from the custom ID
                    sentMessage.guild.id,
                    "TAXI_ACCEPT_STAFF_REQUEST"
                ],
            );
            const endEmbed = new EmbedBuilder()
                .setTitle('Taxi Request Collector Ended')
                .setDescription('The taxi request collector has ended. No further interactions will be processed.')
                .setColor(0xFF0000);
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`delete.taxi.${sentMessage.channel.name.replace(/^taxi-/, '')}`)
                        .setLabel('Delete Request')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️')
                );
            requestuuid = sentMessage
            sentMessage.edit({ embeds: [endEmbed], components: [actionRow] });
            
            sentMessage.channel.send(`<@${taxiRequestUserId}> Your request has not been answered in 5 minutes. You can try again later.`);

            _db.run('INSERT INTO taxi_messages (type, taxiuuid, guildid, messageid, channelid) VALUES ("TAXI_DELETE", ?, ?, ?, ?)', 
                [
                    sentMessage.channel.name.replace(/^taxi-/, ''), // Extract the request UUID from the custom ID
                    sentMessage.guild.id,
                    sentMessage.id,
                    sentMessage.channel.id
                ],
            )

            setupTaxiDeletionCollector(_db, client, sentMessage.id, voiceChannelId, taxiRequestUserId, channel, taxiRoleId);
        });
    });
}

function setupTaxiRequestPersonaCollector(_db, client, sentMessageId, voiceChannelId, taxiRequestUserId, channel, taxiRoleId) {
    channel.messages.fetch(sentMessageId).then(sentMessage => {
        let userHasAnswered = false;
        const collector = sentMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300_000 
        });

        console.log(`TAXI_ACCEPT_PERSONA_REQUEST set up for message ${sentMessageId} in channel ${channel.id} for user ${taxiRequestUserId}.`);

        collector.on('collect', async i => {
            const selection = i.customId.split('.')[0]+"."+i.customId.split('.')[1]; // Get the selection from the custom ID
            // make sure the user that made the interaction is taxiRequestUserId
            if (i.user.id !== taxiRequestUserId) {
                const declineMessage = await i.reply({ content: 'You do not have permission to accept or decline taxi requests.', ephemeral: true });
                await new Promise(resolve => setTimeout(resolve, 3000));
                await declineMessage.delete();
                return;
            }
            
            if (selection === `accept.taxi`) {
                userHasAnswered = true;
                const acceptEmbed = new EmbedBuilder()
                    .setTitle('Taxi Request Accepted! 🚖')
                    .setDescription(`Your taxi request has been accepted by <@${i.user.id}>.`)
                    .setColor(0x00FF00);
                await i.message.edit({ embeds: [acceptEmbed], components: [], content: `` });
                await i.message.channel.send(`<@${taxiRequestUserId}> Your request has been accepted! Please proceed to the designated voice channel: <#${voiceChannelId}>`);
                collector.stop(); 
                _db.run(
                    'DELETE FROM taxi_messages WHERE taxiuuid = ? AND guildid = ? AND messageid = ?',
                    [
                        i.customId.split('.')[2], // Extract the request UUID from the custom ID
                        i.guild.id,
                        i.message.id
                    ],
                );
            } else if (selection === `decline.taxi`) {
                const declineEmbed = new EmbedBuilder()
                    .setTitle('Taxi Request Declined ✖️')
                    .setDescription(`Your taxi request has been declined by <@${i.user.id}>. You can try again later.`)
                    .setColor(0xFF0000);
                await i.message.edit({ embeds: [declineEmbed], components: [], content: `` });
                await i.message.channel.send(`<@${taxiRequestUserId}> Your request has been declined.`);
                collector.stop(); 
                _db.run(
                    'DELETE FROM taxi_messages WHERE taxiuuid = ? AND guildid = ? AND messageid = ?',
                    [
                        i.customId.split('.')[2], // Extract the request UUID from the custom ID
                        i.guild.id,
                        i.message.id
                    ],
                );
            }
        });

        collector.on('end', collected => {
            // edit the message to remove the buttons after the collector ends
            console.log(`Collector ended. Collected ${collected.size} interactions.`);
            if (userHasAnswered) return; // If the user has answered, we don't want to end the request
            _db.run(
                'DELETE FROM taxi_messages WHERE taxiuuid = ? AND guildid = ? AND type = ?',
                [
                    sentMessage.channel.name.replace(/^taxi-/, ''), // Extract the request UUID from the custom ID
                    sentMessage.guild.id,
                    "TAXI_ACCEPT_PERSONA_REQUEST"
                ],
            );
            const endEmbed = new EmbedBuilder()
                .setTitle('Taxi Request Unavailable ✖️')
                    .setDescription(`The requesting user has not answered in 5 minutes.`)
                    .setColor(0xFF0000);
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`delete.taxi.${sentMessage.channel.name.replace(/^taxi-/, '')}`)
                        .setLabel('Delete Request')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️')
                );
            sentMessage.edit({ embeds: [endEmbed], components: [actionRow], content: `<@${taxiRequestUserId}>` });

            sentMessage.channel.send(`<@${taxiRequestUserId}> Your request has not been answered in 5 minutes. You can try again later.`);

            _db.run('INSERT INTO taxi_messages (type, taxiuuid, guildid, messageid, channelid) VALUES ("TAXI_DELETE", ?, ?, ?, ?)', 
                [
                    sentMessage.channel.name.replace(/^taxi-/, ''), // Extract the request UUID from the custom ID
                    sentMessage.guild.id,
                    sentMessage.id,
                    sentMessage.channel.id
                ],
            )

            setupTaxiDeletionCollector(_db, client, sentMessageId, voiceChannelId, taxiRequestUserId, channel, taxiRoleId);
        });
    });
}

function setupTaxiDeletionCollector(_db, client, sentMessageId, voiceChannelId, taxiRequestUserId, channel, taxiRoleId) {
    console.log(`Setting up TAXI_DELETE collector for message ${sentMessageId} in channel ${channel.id} for user ${taxiRequestUserId}.`);
    channel.messages.fetch(sentMessageId).then(sentMessage => {
        const collector = sentMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 2147483647 
        });

        console.log(`TAXI_DELETE set up for message ${sentMessageId} in channel ${channel.id} for user ${taxiRequestUserId}.`);

        collector.on('collect', async i => {
            
            if (i.customId.startsWith('delete.taxi')) {
                collector.stop();
                // delete both the text and voice channel
                const taxiUUID = i.customId.split('.')[1]; // Extract the request UUID from the custom ID
                const voiceChannel = i.guild.channels.cache.get(voiceChannelId)

                const guildid = i.guild.id;
                const messageid = i.message.id;

                if (voiceChannel) {
                    await voiceChannel.delete();
                    console.log(`Deleted voice channel: ${voiceChannel.name}`);
                } else {
                    console.log(`Voice channel not found for taxi UUID: ${taxiUUID}`);
                }
                // delete the text channel
                await channel.delete();
                console.log(`Deleted text channel: ${channel.name}`);

                _db.run(
                    'DELETE FROM taxi_messages WHERE taxiuuid = ? AND guildid = ? AND messageid = ?',
                    [
                        taxiUUID, // Extract the request UUID from the custom ID
                        guildid,
                        messageid
                    ],
                );
            }
        });

        collector.on('end', collected => {
        });
    });
};

module.exports = {
    setupTaxiRequestCollector,
    setupTaxiRequestPersonaCollector,
    setupTaxiDeletionCollector
};