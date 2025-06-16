// touring-helper.js
// Central handler for touring commands

const StarCitizenLocation = require('../../utility/data/location');
const locationData = new StarCitizenLocation; // Your data source
const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Capitalizes the first letter of a string.
 * @param {string} str The string to capitalize.
 * @returns {string} The capitalized string.
 */
function capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Builds an embed and a select menu action row for a command dialog.
 * This function does NOT send the message, but returns the components to be sent or edited.
 *
 * @param {string} title - The title for the embedded message.
 * @param {string} description - The description for the embedded message.
 * @param {Array<{ label: string, value: string, description?: string, emoji?: string }>} selectOptions - An array of objects for the select menu options.
 * @param {string} customId - A unique custom ID for the select menu to handle interactions later.
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }} An object containing the embed and action row.
 */
function buildSelectMenuMessage(title, description, selectOptions, customId) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x0099FF); 

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customId) 
        .setPlaceholder('Make a selection...') 
        .addOptions(selectOptions);


    const actionRow = new ActionRowBuilder()
        .addComponents(selectMenu);

    return { embeds: [embed], components: [actionRow] };
}

async function getLocationSelection(interaction, type) {
    let selectedSystemName = null;
    let selectedPlanetName = null;
    let selectedMoonName = null;

    let currentStep = 'system'; // 'system', 'planet', or 'moon'

    const isPickup = type === 'pickup';
    const locationPrefix = isPickup ? 'pickup' : 'destination';
    const initialMessageDescription = isPickup ? 'Please select your **pickup system**.' : 'Now, please select your **destination system**.';
    const systemTitle = isPickup ? 'Select Pickup System' : 'Select Destination System';
    const planetTitle = isPickup ? 'Select Pickup Planet' : 'Select Destination Planet';
    const moonTitle = isPickup ? 'Select Pickup Moon/Location' : 'Select Destination Moon/Location';

    const disclaimerText = '\n\n*Disclaimer: Not all locations may be immediately accessible depending on in-game server status and available pilot services.*';

    while (true) {
        let messageContent;
        let componentsToAwaitCustomIds = [];

        if (currentStep === 'system') {
            const systems = locationData.getSystems();
            const systemOptions = systems.map(systemName => ({
                label: systemName,
                description: `I want ${isPickup ? 'to get picked up in' : 'to go to'} ${systemName}.`,
                value: `system.${systemName.toLowerCase()}`,
                emoji: '☀️'
            }));
            const systemSelectCustomId = `select.${locationPrefix}.system`;
            messageContent = buildSelectMenuMessage(
                systemTitle,
                `${initialMessageDescription}${disclaimerText}`,
                systemOptions,
                systemSelectCustomId
            );
            componentsToAwaitCustomIds.push(systemSelectCustomId);

        } else if (currentStep === 'planet') {
            const planetsInSelectedSystem = locationData.getPlanets(selectedSystemName);
            if (planetsInSelectedSystem.length === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('Location Error')
                    .setDescription(`No planets found for **${capitalizeFirstLetter(selectedSystemName)}**. Please try again or contact support.`)
                    .setColor(0xFF0000);
                await interaction.editReply({ embeds: [errorEmbed], components: [], ephemeral: true });
                throw new Error('No planets found for selected system.');
            }

            const planetOptions = planetsInSelectedSystem.map(planetName => ({
                label: capitalizeFirstLetter(planetName),
                description: `I want ${isPickup ? 'to get picked up from' : 'to go to'} ${capitalizeFirstLetter(planetName)}.`,
                value: `planet.${planetName.toLowerCase()}`,
                emoji: '🌍'
            }));
            const planetSelectCustomId = `select.${locationPrefix}.planet`;

            messageContent = buildSelectMenuMessage(
                `${planetTitle} in ${capitalizeFirstLetter(selectedSystemName)}`,
                `You selected **${capitalizeFirstLetter(selectedSystemName)}**.\n\n${disclaimerText}`,
                planetOptions,
                planetSelectCustomId
            );
            componentsToAwaitCustomIds.push(planetSelectCustomId);

            const backToSystemButton = new ButtonBuilder()
                .setCustomId(`back.${locationPrefix}.to.system`)
                .setLabel('Back to Systems')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️');
            const backButtonRow = new ActionRowBuilder().addComponents(backToSystemButton);
            messageContent.components.push(backButtonRow);
            componentsToAwaitCustomIds.push(backToSystemButton.data.custom_id);

        } else if (currentStep === 'moon') {
            const moonsInSelectedPlanet = locationData.getMoons(selectedSystemName, selectedPlanetName);

            const moonOptions = [{
                label: `Pickup at ${capitalizeFirstLetter(selectedPlanetName)} (No specific moon)`,
                description: `I want to be picked up directly from ${capitalizeFirstLetter(selectedPlanetName)}.`,
                value: `moon.planetonly`,
                emoji: '🌍',
            }, ...moonsInSelectedPlanet.map(moonName => ({
                label: capitalizeFirstLetter(moonName),
                description: `I want ${isPickup ? 'to get picked up from' : 'to go to'} ${capitalizeFirstLetter(moonName)}.`,
                value: `moon.${moonName.toLowerCase()}`,
                emoji: '🌑',
            }))];
            const moonSelectCustomId = `select.${locationPrefix}.moon`;

            messageContent = buildSelectMenuMessage(
                `${moonTitle} for ${capitalizeFirstLetter(selectedPlanetName)}`,
                `You selected **${capitalizeFirstLetter(selectedPlanetName)}**.\n\nPlease select a moon, or choose to be picked up/dropped off at the planet itself.\n\n${disclaimerText}`,
                moonOptions,
                moonSelectCustomId
            );
            componentsToAwaitCustomIds.push(moonSelectCustomId);

            const backToPlanetButton = new ButtonBuilder()
                .setCustomId(`back.${locationPrefix}.to.planet`)
                .setLabel('Back to Planets')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️');
            const backButtonRow = new ActionRowBuilder().addComponents(backToPlanetButton);
            messageContent.components.push(backButtonRow);
            componentsToAwaitCustomIds.push(backToPlanetButton.data.custom_id);
        }

        await interaction.editReply(messageContent);

        const responseFilter = i => componentsToAwaitCustomIds.includes(i.customId) && i.user.id === interaction.user.id;
        const response = await interaction.channel.awaitMessageComponent({ filter: responseFilter, time: 60000 });
        await response.deferUpdate();

        if (response.customId.startsWith('back.')) {
            const backTarget = response.customId.split('.').pop(); // 'system' or 'planet'
            if (backTarget === 'system') {
                currentStep = 'system';
                selectedSystemName = null;
                selectedPlanetName = null;
                selectedMoonName = null;
            } else if (backTarget === 'planet') {
                currentStep = 'planet';
                selectedPlanetName = null;
                selectedMoonName = null;
            }
            continue; 
        }

        const selectedValue = response.values[0];
        const valueParts = selectedValue.split('.'); 

        if (valueParts[0] === 'system') {
            selectedSystemName = capitalizeFirstLetter(valueParts[1]);
            currentStep = 'planet';
        } else if (valueParts[0] === 'planet') {
            selectedPlanetName = capitalizeFirstLetter(valueParts[1]);
            const moonsCheck = locationData.getMoons(selectedSystemName, selectedPlanetName);
            if (moonsCheck.length === 0) {
                selectedMoonName = null; 
                break; 
            } else {
                currentStep = 'moon';
            }
        } else if (valueParts[0] === 'moon') {
            if (valueParts[1] === 'planetonly') {
                selectedMoonName = null; 
            } else {
                selectedMoonName = capitalizeFirstLetter(valueParts[1]);
            }
            break; 
        }
    } 

    return { selectedSystemName, selectedPlanetName, selectedMoonName };
}

async function handleTouringCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    let pickupLocation = {};
    let destinationLocation = {};

    try {
        console.log('Starting pickup location selection...');
        pickupLocation = await getLocationSelection(interaction, 'pickup');
        console.log('Pickup location selected:', pickupLocation);

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

        console.log('Starting destination location selection...');
        destinationLocation = await getLocationSelection(interaction, 'destination');
        console.log('Destination location selected:', destinationLocation);

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
                { name: 'Disclaimer', value: 'By confirming this request, you agree to the terms of service. Our pilots will do their best to fulfill your request promptly, but service availability and travel times may vary based on in-game conditions, server status, and pilot availability. Please be ready at your designated pickup location. In case of unexpected issues, your pilot will contact you.' }
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
        const buttonResponse = await interaction.channel.awaitMessageComponent({ filter: buttonFilter, time: 120000 }); // 2 minutes to respond

        await buttonResponse.deferUpdate();

        if (buttonResponse.customId === 'confirm.taxi.agree') {
            const successEmbed = new EmbedBuilder()
                .setTitle('Taxi Request Created! 🚀')
                .setDescription(`Your pilot will be in touch soon.\n\n**Pickup:** ${finalPickupString}\n**Destination:** ${finalDestinationString}`)
                .setColor(0x00FF00); 

            await interaction.editReply({
                embeds: [successEmbed],
                components: [], // Remove buttons
                ephemeral: true
            });
        } else if (buttonResponse.customId === 'confirm.taxi.decline') {
            const cancelledEmbed = new EmbedBuilder()
                .setTitle('Taxi Request Cancelled 🛑')
                .setDescription('You have cancelled your taxi request. Feel free to try again anytime!')
                .setColor(0xFF0000); // Red

            await interaction.editReply({
                embeds: [cancelledEmbed],
                components: [], // Remove buttons
                ephemeral: true
            });
        }

    } catch (error) {
        if (error.message.includes('time')) {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('Request Timed Out ⏰')
                .setDescription('You did not complete your request in time. Please try the command again.')
                .setColor(0xFFA500); // Orange

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
                .setColor(0xFF0000); // Red

            console.error('Error during taxi service interaction:', error);
            await interaction.editReply({
                embeds: [generalErrorEmbed],
                components: [],
                ephemeral: true
            });
        }
    }
}

module.exports = { handleTouringCommand };