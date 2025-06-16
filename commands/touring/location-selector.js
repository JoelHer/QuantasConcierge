// location-selector.js
// Handles the multi-step location selection process with back functionality

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
    // Create an embed for the title and description
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x0099FF); // You can customize the color

    // Create a select menu with the provided options
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(customId) // Unique ID for this select menu
        .setPlaceholder('Make a selection...') // Default text when nothing is selected
        .addOptions(selectOptions); // Add the array of options

    // Create an action row to hold the select menu
    const actionRow = new ActionRowBuilder()
        .addComponents(selectMenu);

    return { embeds: [embed], components: [actionRow] };
}

/**
 * Guides the user through a multi-step location selection (System > Planet > Moon) with a "back" option.
 *
 * @param {Interaction} interaction - The Discord.js interaction object.
 * @param {'pickup' | 'destination'} type - The type of location being selected ('pickup' or 'destination').
 * @returns {Promise<{ selectedSystemName: string, selectedPlanetName: string, selectedMoonName: string | null }>}
 * An object containing the selected system, planet, and optionally moon names.
 * @throws {Error} If no planets are found for a selected system or if the interaction times out.
 */
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

    // Loop through the selection steps until a final location is chosen or an error/timeout occurs
    while (true) {
        let messageContent;
        let componentsToAwaitCustomIds = []; // IDs for both select menus and back buttons

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

            // Add 'Back to Systems' button
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

            // Add 'Back to Planets' button
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

module.exports = { getLocationSelection };