// touring-helper.js
// Central handler for touring commands

// Import getLocationSelection from the new file
const { getLocationSelection } = require('./location-selector');

const { setupTaxiRequestCollector } = require('./taxiHelpers/collectors');

const StarCitizenLocation = require('../../utility/data/location'); // Keep this as location-selector.js needs it
const locationData = new StarCitizenLocation; // Keep this as location-selector.js needs it

// Only import what's needed for the main handler now
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, ComponentType } = require('discord.js');

const { getSetting } = require('../../utility/dbHelper');
const { db } = require('../../bot');

const { v4: uuidv4 } = require('uuid');

async function handleTouringCommand(interaction, taxiRequestCategory) {
    await interaction.deferReply({ ephemeral: true });
    const situation = interaction.options.getString('situation');
    const threatLevel = interaction.options.getString('threat-level');
    const rsiHandle = interaction.options.getString('rsi-handle');
    const notes = interaction.options.getString('notes') || 'No additional notes.';

    if (situation === 's_dead') {
        const deadEmbed = new EmbedBuilder()
            .setTitle('Please contact MedRunners')
            .setDescription('Sorry, but we currently dont\'t provide rescue services. Please contact the MedRunners for assistance. You can directly contact them [here](http://portal.medrunner.space/).')
            .setColor(0xFF0000);
        await interaction.editReply({
            embeds: [deadEmbed],
            ephemeral: true
        });
        return;
    }

    taxiChannelCategory = await getSetting(db, interaction.guild.id, 'taxi_category');
    taxiRoleId = await getSetting(db, interaction.guild.id, 'taxi_role');
    if (!taxiChannelCategory || !taxiRoleId) {
        interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Taxi Service Unavailable')
                    .setDescription('The taxi service is currently disabled on this server. If you think this is an error, please contact an admin. Please try again later.')
                    .setColor(0xFF0000)
            ],
            ephemeral: true
        });
        return;
    }


    let pickupLocation = {};
    let destinationLocation = {};

    try {
        // --- Get Pickup Location ---
        console.log('Starting pickup location selection...');
        // Call the imported function
        pickupLocation = await getLocationSelection(interaction, 'pickup');

        const pickupConfirmationEmbed = new EmbedBuilder()
            .setTitle('Pickup Location Confirmed!')
            .setDescription(`Great! Your pickup location is set to **${pickupLocation.selectedSystemName}** > **${pickupLocation.selectedPlanetName}${pickupLocation.selectedMoonName ? ' > ' + pickupLocation.selectedMoonName : ''}**.`)
            .setColor(0x32CD32);

        await interaction.editReply({
            embeds: [pickupConfirmationEmbed],
            components: [],
            ephemeral: true
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        // --- Get Destination Location ---
        // Call the imported function again for destination
        destinationLocation = await getLocationSelection(interaction, 'destination');

        // --- Final Confirmation with Agree/Decline Buttons ---
        let finalPickupString = `**${pickupLocation.selectedSystemName}** > **${pickupLocation.selectedPlanetName}`;
        if (pickupLocation.selectedMoonName) {
            finalPickupString += ` > ${pickupLocation.selectedMoonName}`;
        }
        finalPickupString += '**';

        let finalDestinationString = `**${destinationLocation.selectedSystemName}** > **${destinationLocation.selectedPlanetName}`;
        if (destinationLocation.selectedMoonName) {
            finalDestinationString += ` > ${destinationLocation.selectedMoonName}`;
        }
        finalDestinationString += '**';

        const finalConfirmationEmbed = new EmbedBuilder()
            .setTitle('Confirm Your Taxi Request')
            .setDescription(`Please review your request:\n\n**Pickup:** ${finalPickupString}\n**Destination:** ${finalDestinationString}`)
            .addFields(
                { name: 'Disclaimer', value: 'By confirming this request, you agree to the terms of service. Our pilots will do their best to fulfill your request promptly, but service availability and travel times may vary based on in-game conditions, server status, and pilot availability. Please be ready at your designated pickup location. In case of unexpected issues, your pilot will contact you.\n\n**Time disclaimer:**\nPlease be aware, that it can take up to 10 minutes for your request to be confirmed, it also may be cancelled if no employees are available.' }
            )
            .setColor(0xFFA500);

        const agreeButton = new ButtonBuilder()
            .setCustomId('confirm.taxi.agree')
            .setLabel('Agree & Request Taxi')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

        const declineButton = new ButtonBuilder()
            .setCustomId('confirm.taxi.decline')
            .setLabel('Cancel Request')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✖️');

        const buttonRow = new ActionRowBuilder()
            .addComponents(agreeButton, declineButton);

        await interaction.editReply({
            embeds: [finalConfirmationEmbed],
            components: [buttonRow],
            ephemeral: true
        });

        const buttonFilter = i => ['confirm.taxi.agree', 'confirm.taxi.decline'].includes(i.customId) && i.user.id === interaction.user.id;
        const buttonResponse = await interaction.channel.awaitMessageComponent({ filter: buttonFilter, time: 120000 });

        if (buttonResponse.customId === 'confirm.taxi.agree') {
            const agreeButton = new ButtonBuilder()
                .setCustomId('confirm.taxi.agree')
                .setLabel('Agree & Request Taxi')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true) // Disable the decline button after agreeing
                .setEmoji('✅');

            const declineButton = new ButtonBuilder()
                .setCustomId('confirm.taxi.decline')
                .setLabel('Cancel Request')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true) // Disable the decline button after agreeing
                .setEmoji('✖️');


            const buttonRow = new ActionRowBuilder()
                .addComponents(agreeButton, declineButton);

            await interaction.editReply({
                components: [buttonRow]
            });

            const requestUUID = uuidv4();
            let textChannel, voiceChannel;

            taxiRoleId = taxiRoleId.replace(/<@&(\d+)>/, '$1');


            try {
                const permissionOverwrites = [
                    {
                        id: interaction.guild.roles.everyone, // @everyone role
                        deny: [PermissionsBitField.Flags.ViewChannel], // Hide channel for everyone by default
                    },
                    {
                        id: interaction.user.id, // User who invoked the command
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
                    },
                    {
                        id: taxiRoleId, // Role that should also see the channel
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
                    }
                ];

                textChannel = await interaction.guild.channels.create({
                    name: 'taxi-' + requestUUID,
                    type: ChannelType.GuildText,
                    parent: taxiChannelCategory,
                    reason: 'Taxi request for ' + interaction.user.username,
                    permissionOverwrites
                });

                voiceChannel = await interaction.guild.channels.create({
                    name: 'taxi-' + requestUUID,
                    type: ChannelType.GuildVoice,
                    parent: taxiChannelCategory,
                    reason: 'Taxi request for ' + interaction.user.username,
                    permissionOverwrites
                });

                console.log(`Created channels: ${textChannel.name} and ${voiceChannel.name} under category ID ${taxiChannelCategory}`);
            } catch (err) {
                console.error('Error creating channel:', err);
                const errorEmbed = new EmbedBuilder()
                    .setTitle('Channel Creation Error ⚠️')
                    .setDescription('An error occurred while creating the channels for your taxi request. Please try again later, your request has been canceled.')
                    .setColor(0xFF0000);
                await interaction.editReply({
                    embeds: [errorEmbed],
                    components: [],
                    ephemeral: true
                });
                return;
            }


            const setupEmbed = new EmbedBuilder()
                .setTitle('Hold Tight! 🚖')
                .setDescription(`Just one second, we are setting up your taxi request...\n\n**Pickup:** ${finalPickupString}\n**Destination:** ${finalDestinationString}\nYour request ID is \`${requestUUID}\`. Please keep this for reference.`)
                .setColor(0x00FF00);
            await interaction.editReply({
                embeds: [setupEmbed],
                components: [],
                ephemeral: true
            });
            
            console.log('Setting up taxi request.\nFROM:', pickupLocation, '\nTO:', destinationLocation, '\nRequest ID:', requestUUID);

            db.run(
                'INSERT INTO taxi_requests (request_id, guild_id, user_id, taxi_request_category, threat_level, situation, notes, assigned_text_channel, assigned_voice_channel, pickup_system, pickup_planet, pickup_moon, destination_system, destination_planet, destination_moon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    requestUUID,
                    interaction.guild.id,
                    interaction.user.id,
                    taxiRequestCategory,
                    threatLevel,
                    situation,
                    notes,
                    textChannel.id,
                    voiceChannel.id,
                    pickupLocation.selectedSystemName,
                    pickupLocation.selectedPlanetName,
                    pickupLocation.selectedMoonName || null,
                    destinationLocation.selectedSystemName,
                    destinationLocation.selectedPlanetName,
                    destinationLocation.selectedMoonName || null
                ],
                (error, results) => {
                    if (error) {
                        console.error('Error inserting taxi request into database:', error);
                        const errorEmbed = new EmbedBuilder()
                            .setTitle('Database Error ⚠️')
                            .setDescription('An error occurred while processing your taxi request. Please try again later.')
                            .setColor(0xFF0000);
                        interaction.editReply({
                            embeds: [errorEmbed],
                            components: [],
                            ephemeral: true
                        });
                        return;
                    }
                    const successEmbed = new EmbedBuilder()
                        .setTitle('Taxi Request Created! 🚀')
                        .setDescription(`Your taxi request has been successfully created! Your pilot will be with you shortly.\n\n**Pickup:** ${finalPickupString}\n**Destination:** ${finalDestinationString}\nVoice channel: <#${voiceChannel.id}>\nText channel: <#${textChannel.id}>\n\nYour request ID is \`${requestUUID}\`. Please keep this for reference.`)
                        .setColor(0x00FF00);
        
                    interaction.editReply({
                        embeds: [successEmbed],
                        components: [],
                        ephemeral: true
                    });

                    const requestEmbed = new EmbedBuilder()
                        .setTitle('Taxi Request')
                        .setDescription(`A new taxi request has been created by <@${interaction.user.id}>.\n*RSI-Handle: ${rsiHandle}*\n\n**Pickup:** ${finalPickupString}\n**Destination:** ${finalDestinationString}\n\n**Situation:**\n${situation.substring(2).toUpperCase()}\n\n**Threat level:**\n${threatLevel.substring(2).toUpperCase()}\n\n**Notes:**\n${notes}\n\nA staff member still needs to accept this request within 5 minutes.`)
                        .setColor(0xFFFF00)
                        .setFooter({ text: `Request ID: ${requestUUID}` });
                    
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
                

                    textChannel.send({
                        embeds: [requestEmbed],
                        content: `<@&${taxiRoleId}> <@${interaction.user.id}>`, 
                        components: [actionRow],
                    }).then(sentMessage => {
                        setupTaxiRequestCollector(db, interaction.client, sentMessage.id, voiceChannel.id, interaction.user.id, sentMessage.channel, taxiRoleId);
                        db.run(
                            'INSERT INTO taxi_messages (type, taxiuuid, guildid, messageid, channelid) VALUES ("TAXI_ACCEPT_STAFF_REQUEST", ?, ?, ?, ?)',
                            [
                                requestUUID,
                                interaction.guild.id,
                                sentMessage.id,
                                sentMessage.channel.id
                            ],
                            (err) => {
                                if (err) {
                                    console.error('Error inserting announcement into database:', err);
                                } else {
                                    console.log('Taxi Request inserted into database successfully.');
                                }
                            }
                        );
                        
                    });
                }
            );

        } else if (buttonResponse.customId === 'confirm.taxi.decline') {
            const cancelledEmbed = new EmbedBuilder()
                .setTitle('Taxi Request Cancelled 🛑')
                .setDescription('You have cancelled your taxi request. Feel free to try again anytime!')
                .setColor(0xFF0000);

            await interaction.editReply({
                embeds: [cancelledEmbed],
                components: [],
                ephemeral: true
            });
        }

    } catch (error) {
        if (error.message.includes('time')) {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('Request Timed Out ⏰')
                .setDescription('You did not complete your request in time. Please try the command again.')
                .setColor(0xFFA500);

            console.log('User did not select an option or press a button in time.');
            await interaction.editReply({
                embeds: [timeoutEmbed],
                components: [],
                ephemeral: true
            });
        } else {
            const generalErrorEmbed = new EmbedBuilder()
                .setTitle('An Error Occurred ⚠️')
                .setDescription('An unexpected error occurred during your taxi request. Please try again later.')
                .setColor(0xFF0000);

            console.error('Error during taxi service interaction:', error);
            await interaction.editReply({
                embeds: [generalErrorEmbed],
                components: [],
                ephemeral: true
            });
        }
    }
}


module.exports = { handleTouringCommand, setupTaxiRequestCollector };