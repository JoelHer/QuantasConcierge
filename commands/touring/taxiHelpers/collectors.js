const { EmbedBuilder, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, ButtonComponent, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const { getSetting } = require('../../../utility/dbHelper');

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

            const fetched_taxirequest = await new Promise((resolve, reject) => {
                _db.get(
                    `SELECT * FROM taxi_requests WHERE request_id = ?`,
                    [requestUUID],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!i.member.roles.cache.has(taxiRoleId)) {
                const declineMessage = await i.reply({ content: 'You do not have permission to accept or decline taxi requests.', ephemeral: true });
                await new Promise(resolve => setTimeout(resolve, 3000));
                await declineMessage.delete();
                return;
            }
            
            if (selection === `accept.taxi`) {
                const acceptedPeople = fetched_taxirequest.accepted_people
                    .split(';')
                    .filter(person => person !== "");

                const currentamountOfEmployees = acceptedPeople.length + 1; // +1 for the current user accepting the request
                const threat_level = fetched_taxirequest.threat_level;
                const neededForPVP = 2
                const neededForPVE = 1 // change this in the future

                await new Promise((resolve, reject) => {
                    _db.get(
                        `UPDATE taxi_requests SET accepted_people = ? WHERE request_id = ?`,
                        [fetched_taxirequest.accepted_people+i.user.username+";",requestUUID],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });

                if (threat_level === 't_pvp' && currentamountOfEmployees < neededForPVP) {
                    i.deferUpdate(); // Deferring the update to remove the "interaction failed" message
                    // Send message in channel indicating that another employee needs to accept the request
                    const insufficientEmbed = new EmbedBuilder()
                        .setTitle('An employee has accepted your request, insufficient employees for PVP request')
                        .setDescription('<@'+i.user.id + `> has accepted your request. \n\nThis is a PVP request and requires at least ${neededForPVP} employees to accept it. Currently, only ${currentamountOfEmployees} employees have accepted the request.`)
                        .setColor(0xFF0000);
                    await i.channel.send({ embeds: [insufficientEmbed] });
                    return;
                }

                if (threat_level === 't_pve' && currentamountOfEmployees < neededForPVE) {
                    i.deferUpdate(); // Deferring the update to remove the "interaction failed" message
                    // Send message in channel indicating that another employee needs to accept the request
                    const insufficientEmbed = new EmbedBuilder()
                        .setTitle('An employee has accepted your request, insufficient employees for PVE request')
                        .setDescription('<@'+i.user.id + `> has accepted your request. \n\nThis is a PVE request and requires at least ${neededForPVE} employees to accept it. Currently, only ${currentamountOfEmployees} employees have accepted the request.`)
                        .setColor(0xFF0000);
                    await i.channel.send({ embeds: [insufficientEmbed] });
                    return;
                }

                if (currentamountOfEmployees == neededForPVE || currentamountOfEmployees == neededForPVP) {
                    // Send message in channel indicating that the request is ready to be accepted
                    const readyEmbed = new EmbedBuilder()
                        .setTitle('An employee has accepted your request, ready to be accepted')
                        .setDescription('<@'+i.user.id + `> has accepted your request. \n\nThis request is now ready to be accepted by the requesting user. Please wait for them to confirm.`)
                        .setColor(0x00FF00);
                    await i.channel.send({ embeds: [readyEmbed] });
                }

                employeeHasAnswered = true;
                const acceptEmbed = new EmbedBuilder()
                    .setTitle('Waiting for the user\'s final confirmation... ⏳')
                    .setDescription(`Your taxi request has been accepted by <@${i.user.id}>. Now it's up to <@${taxiRequestUserId}> to confirm the ride.\n\nPlease confirm your taxi request one last time by clicking one of the buttons below:`)
                    .setColor(0x00FF00);

                const newactionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Manage Request')
                            .setStyle(ButtonStyle.Primary)
                            .setCustomId('manage.taxi.request')
                    );

                
                await i.message.edit({ components: [] });
                await i.deferUpdate(); // Deferring the update to remove the "interaction failed" message
                await i.message.edit({ components: [newactionRow] });

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
                        requestUUID, 
                        i.guild.id,
                        i.message.id
                    ],
                );
                _db.run(
                    'INSERT INTO taxi_messages (type, taxiuuid, guildid, messageid, channelid) VALUES ("TAXI_ACCEPT_PERSONA_REQUEST", ?, ?, ?, ?)',
                    [
                        requestUUID,
                        i.guild.id,
                        resp.id,
                        i.message.channel.id
                    ],
                );
                _db.run(
                    'INSERT INTO taxi_messages (type, taxiuuid, guildid, messageid, channelid) VALUES ("TAXI_MANAGE", ?, ?, ?, ?)',
                    [
                        requestUUID, 
                        i.guild.id,
                        i.message.id,
                        i.message.channel.id
                    ],
                );
                setupTaxiRequestPersonaCollector(_db, client, resp.id, voiceChannelId, taxiRequestUserId, channel, taxiRoleId);
                setupTaxiManagementCollector(_db, client, i.message.id, voiceChannelId, taxiRequestUserId, channel, taxiRoleId);
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
                    .setDescription(`Taxi Request Confirmed. The request has been confirmed by the passenger, <@${i.user.id}>.`)
                    .setColor(0x00FF00);
                await i.message.edit({ embeds: [acceptEmbed], components: [], content: `` });
                await i.message.channel.send(`<@${taxiRequestUserId}> If necessary/preferred, you can now proceed to the designated voice channel: <#${voiceChannelId}>`);
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
    try {
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
                    const voiceChannel = await i.guild.channels.fetch(voiceChannelId)
                    const textChannel = await i.guild.channels.fetch(channel.id);
    
                    const guildid = i.guild.id;
                    const messageid = i.message.id;
    
                    if (voiceChannel) {
                        await voiceChannel.delete();
                        console.log(`Deleted voice channel: ${voiceChannel.name}`);
                    } else {
                        console.log(`Voice channel not found for taxi UUID: ${taxiUUID}`);
                    }
                    // delete the text channel
                    await textChannel.delete();
                    console.log(`Deleted text channel: ${channel.name}`);
    
                    _db.run(
                        'DELETE FROM taxi_messages WHERE taxiuuid = ? AND guildid = ? AND messageid = ?',
                        [
                            taxiUUID, // Extract the request UUID from the custom ID
                            guildid,
                            messageid
                        ],
                    );
                } else if (i.customId.startsWith('feedback.taxi')) {
                    const taxiUUID = i.customId.split('.')[2]; // Extract the request UUID from the custom ID
                    const modal = new ModalBuilder()
                        .setCustomId('taxiFeedbackModal.'+taxiUUID)
                        .setTitle('Taxi Feedback');

                    const feedbackInput = new TextInputBuilder()
                        .setCustomId('feedbackInput')
                        .setLabel("What did you think about the taxi service?")
                        // Paragraph means multiple lines of text.
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(800)

                    const firstActionRow = new ActionRowBuilder().addComponents(feedbackInput);

                    modal.addComponents(firstActionRow);

                    await i.showModal(modal);
                }
            });
    
            collector.on('end', collected => {
            });
        });
    } catch (error) {
        console.error(`Error setting up TAXI_DELETE collector: ${error.message}`);
    }
};

function setupTaxiManagementCollector(_db, client, sentMessageId, voiceChannelId, taxiRequestUserId, channel, taxiRoleId) {
    console.log(`Setting up TAXI_MANAGE collector for message ${sentMessageId} in channel ${channel.id} for user ${taxiRequestUserId}.`);
    channel.messages.fetch(sentMessageId).then(sentMessage => {
        const collector = sentMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 2147483647 
        });

        console.log(`TAXI_MANAGE set up for message ${sentMessageId} in channel ${channel.id} for user ${taxiRequestUserId}.`);

        collector.on('collect', async i => {
            
            if (i.customId.startsWith('manage.taxi.request')) {
                // check if user has permission to manage the taxi request
                taxiRoleId = (await getSetting(_db, i.guild.id, 'taxi_role')).replace(/<@&(\d+)>/, '$1');

                if (!i.member.roles.cache.has(taxiRoleId)) {
                    const declineMessage = await i.reply({ content: 'You do not have permission to manage taxi requests.', ephemeral: true });
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await declineMessage.delete();
                    return;
                }

                const manageEmbed = new EmbedBuilder()
                    .setTitle('Manage Taxi Request')
                    .setDescription(`You can manage your taxi request here. Please choose to accept or decline the request.`)
                    .setColor(0xFFFF00);

                const retrievedTaxiStatus = await new Promise((resolve, reject) => {
                    _db.get(
                        `SELECT payment_status, taxi_status FROM taxi_requests WHERE request_id = ?`,
                        [i.channel.name.replace(/^taxi-/, '')], // maybe get the uuid differently in the future to avoid issues with channel names
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });

                console.log(`Retrieved taxi status for request UUID: ${i.channel.name.replace(/^taxi-/, '')}`, retrievedTaxiStatus);

                const actionRow1 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`status.payment.accepted.${i.customId.split('.')[2]}`)
                            .setLabel('Payment Accepted')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅')
                            .setDisabled(!(retrievedTaxiStatus.payment_status != 'PAYMENT_ACCEPTED')),
                        new ButtonBuilder()
                            .setCustomId(`status.taxi.accepted${i.customId.split('.')[2]}`)
                            .setLabel('Taxi Complete')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅')
                            .setDisabled(!(retrievedTaxiStatus.taxi_status != 'TAXI_ACCEPTED'))
                        
                    );
                
                const actionRow2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`status.payment.failed.${i.customId.split('.')[2]}`)
                            .setLabel('Payment Failed')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('✖️')
                            .setDisabled(!(retrievedTaxiStatus.payment_status != 'PAYMENT_FAILED')),
                        new ButtonBuilder()
                            .setCustomId(`status.taxi.failed.${i.customId.split('.')[2]}`)
                            .setLabel('Taxi Failed')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('✖️')
                            .setDisabled(!(retrievedTaxiStatus.taxi_status != 'TAXI_FAILED'))
                    );

                let disableCloseRequest = (retrievedTaxiStatus.taxi_status == null) || (retrievedTaxiStatus.payment_status == null);

                let additionalDescription = disableCloseRequest ?
                    `\n\nYou can close the request once the payment has been accepted or the taxi has been completed.` :
                    `\n\nYou can now close the request by opening this menu again.`;

                const actionRow3 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`close.taxi.${i.channel.name.replace(/^taxi-/, '')}`)
                            .setLabel('Close Request')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🗑️')
                            .setDisabled(disableCloseRequest)
                    );

                //send new message with the manage embed and action row
                await i.reply({ embeds: [manageEmbed], components: [actionRow1, actionRow2, actionRow3], ephemeral: true });
                const managementMessage = await i.fetchReply(); // This gets the ephemeral message you just sent

                const managementCollector = managementMessage.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 600_000 // 10 minutes
                });


                managementCollector.on('collect', async j => {
                    const selection = j.customId
                    const requestUUID = j.channel.name.replace(/^taxi-/, ''); // Extract the request UUID from the channel name

                    console.log(`Management collector interaction: ${selection} for request UUID: ${requestUUID}`);

                    if (selection.startsWith(`status.payment.accepted`)) {
                        _db.run(
                            'UPDATE taxi_requests SET payment_status = ? WHERE request_id = ? AND guild_id = ?',
                            [
                                'PAYMENT_ACCEPTED',
                                requestUUID, // Extract the request UUID from the custom ID
                                j.guild.id
                            ],
                        );
                        const paymentAcceptedEmbed = new EmbedBuilder()
                            .setTitle('Payment Accepted 💰')
                            .setDescription(`The payment for the taxi request has been accepted.`+additionalDescription)
                            .setColor(0x00FF00);
                        await j.update({ embeds: [paymentAcceptedEmbed], components: [], content: `<@${taxiRequestUserId}>` });
                    } else if (selection.startsWith(`status.taxi.accepted`)) {
                        _db.run(
                            'UPDATE taxi_requests SET taxi_status = ?, request_closed_tmsp = ? WHERE request_id = ? AND guild_id = ?',
                            [
                                'TAXI_ACCEPTED',
                                parseInt(Date.now()/1000),
                                requestUUID, // Extract the request UUID from the custom ID
                                j.guild.id
                            ],
                        );
                        const taxiAcceptedEmbed = new EmbedBuilder()
                            .setTitle('Taxi Request Completed 🚖')
                            .setDescription(`The taxi request has been completed successfully.`+additionalDescription)
                            .setColor(0x00FF00);
                        await j.update({ embeds: [taxiAcceptedEmbed], components: [], content: `<@${taxiRequestUserId}>` });
                    } else if (selection.startsWith(`status.payment.failed`)) {
                        _db.run(
                            'UPDATE taxi_requests SET payment_status = ? WHERE request_id = ? AND guild_id = ?',
                            [
                                'PAYMENT_FAILED',
                                requestUUID, // Extract the request UUID from the custom ID
                                j.guild.id
                            ],
                        );
                        const paymentFailedEmbed = new EmbedBuilder()
                            .setTitle('Payment Failed ❌')
                            .setDescription(`The payment for the taxi request has failed.`+additionalDescription)
                            .setColor(0xFF0000);
                        await j.update({ embeds: [paymentFailedEmbed], components: [], content: `<@${taxiRequestUserId}>` });
                    } else if (selection.startsWith(`status.taxi.failed`)) {
                        _db.run(
                            'UPDATE taxi_requests SET taxi_status = ?, request_closed_tmsp = ? WHERE request_id = ? AND guild_id = ?',
                            [
                                'TAXI_FAILED',
                                parseInt(Date.now()/1000),
                                requestUUID, // Extract the request UUID from the custom ID
                                j.guild.id
                            ],
                        );
                        const taxiFailedEmbed = new EmbedBuilder()
                            .setTitle('Taxi Request Failed ❌')
                            .setDescription(`The taxi request has failed.`+additionalDescription)
                            .setColor(0xFF0000);
                        await j.update({ embeds: [taxiFailedEmbed], components: [], content: `<@${taxiRequestUserId}>` });
                    } else if (selection.startsWith(`close.taxi`)) {
                        // send new message with the delete button
                        const closeEmbed = new EmbedBuilder()
                            .setTitle('Taxi Request Closed')
                            .setDescription(`The taxi request has been closed. You can delete the request now.`)
                            .setColor(0x00FF00);
                        const actionRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`delete.taxi.${requestUUID}`)
                                    .setLabel('Delete Request')
                                    .setStyle(ButtonStyle.Danger)
                                    .setEmoji('🗑️'),
                                new ButtonBuilder()
                                    .setCustomId(`feedback.taxi.${i.channel.name.replace(/^taxi-/, '')}`)
                                    .setLabel('Send Feedback')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('📝')
                            );
                        j.deferUpdate(); // Deferring the update to remove the "interaction failed" message
                        const newDeletionMessage = await j.channel.send({ embeds: [closeEmbed], components: [actionRow], content: `<@${taxiRequestUserId}>` });
                        let management_updates_channel = await getSetting(_db, j.guild.id, "management_updates_channel")

                        management_updates_channel = management_updates_channel.replace(/<#(\d+)>/, '$1')

                        const managementChannel = await j.client.channels.fetch(management_updates_channel)

                        const retrievedTaxiRow = await new Promise((resolve, reject) => {
                            _db.get(
                                `SELECT * FROM taxi_requests WHERE request_id = ?`,
                                [i.channel.name.replace(/^taxi-/, '')], // maybe get the uuid differently in the future to avoid issues with channel names
                                (err, row) => {
                                    if (err) reject(err);
                                    else resolve(row);
                                }
                            );
                        });

                        const getDurationString = function(openedSec, closedSec) {
                            const diffMs = (closedSec - openedSec) * 1000;
                            const totalMinutes = Math.floor(diffMs / 60000);
                            const hours = Math.floor(totalMinutes / 60);
                            const minutes = totalMinutes % 60;

                            if (hours > 0 && minutes > 0) {
                                return `${hours} Hour${hours !== 1 ? 's' : ''} and ${minutes} Minute${minutes !== 1 ? 's' : ''}`;
                            } else if (hours > 0) {
                                return `${hours} Hour${hours !== 1 ? 's' : ''}`;
                            } else {
                                return `${minutes} Minute${minutes !== 1 ? 's' : ''}`;
                            }
                        }

                        const summaryEmbed = new EmbedBuilder()
                            .setTitle('Taxi Request Completed.')
                            .setDescription(`**Here is a quick summary of everything important:**`)
                            .addFields(
                                {name: "Requester", value: '<@'+retrievedTaxiRow.user_id+'>', inline: true},
                                {name: "Employees", value: retrievedTaxiRow.accepted_people.split(";").join(" "), inline: true},
                                {name: "Request Opened", value: '<t:'+retrievedTaxiRow.request_openend_tmsp+':t>', inline: true},
                                {name: "Request Closed", value: '<t:'+retrievedTaxiRow.request_closed_tmsp+':t>', inline: true},
                                {name: "Duration", value: getDurationString(retrievedTaxiRow.request_openend_tmsp, retrievedTaxiRow.request_closed_tmsp), inline: true},
                                {name: "Payment Status", value: retrievedTaxiRow.payment_status, inline: true},
                                {name: "Taxi Status", value: retrievedTaxiRow.taxi_status, inline: true}
                            )
                            .setFooter({ text: `Request ID: ${retrievedTaxiRow.request_id}` })
                            .setColor(0x00FF00);

                        managementChannel.send({embeds: [summaryEmbed]})

                        _db.run(
                            'DELETE FROM taxi_messages WHERE taxiuuid = ? AND guildid = ? AND messageid = ?',
                            [
                                requestUUID, // Extract the request UUID from the custom ID
                                j.guild.id,
                                j.message.id
                            ],
                        );

                        _db.run(
                            'INSERT INTO taxi_messages (type, taxiuuid, guildid, messageid, channelid) VALUES ("TAXI_DELETE", ?, ?, ?, ?)',
                            [
                                requestUUID, // Extract the request UUID from the custom ID
                                j.guild.id,
                                newDeletionMessage.id,
                                j.channel.id
                            ],
                        );

                        setupTaxiDeletionCollector(_db, client, newDeletionMessage.id, voiceChannelId, taxiRequestUserId, channel, taxiRoleId);
                    }
                });

                managementCollector.on('end', collected => {
                    try {
                        managementMessage.delete();
                    } catch (e) {
                        console.log('Something went wrong: ', e)
                    }
                })
            }
        });

        collector.on('end', collected => {
            
        });
    });
};

module.exports = {
    setupTaxiRequestCollector,
    setupTaxiRequestPersonaCollector,
    setupTaxiDeletionCollector,
    setupTaxiManagementCollector
};