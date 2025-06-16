// touring-helper.js
// Central handler for touring commands

// Import getLocationSelection from the new file
const { getLocationSelection } = require('./location-selector');

const StarCitizenLocation = require('../../utility/data/location'); // Keep this as location-selector.js needs it
const locationData = new StarCitizenLocation; // Keep this as location-selector.js needs it

// Only import what's needed for the main handler now
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');


// The capitalizeFirstLetter and buildSelectMenuMessage functions are now in location-selector.js
// They are used internally by getLocationSelection, so no longer needed here.


async function handleTouringCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    let pickupLocation = {};
    let destinationLocation = {};

    try {
        // --- Get Pickup Location ---
        console.log('Starting pickup location selection...');
        // Call the imported function
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

        // --- Get Destination Location ---
        console.log('Starting destination location selection...');
        // Call the imported function again for destination
        destinationLocation = await getLocationSelection(interaction, 'destination');
        console.log('Destination location selected:', destinationLocation);

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
            .setEmoji('❌');

        const buttonRow = new ActionRowBuilder()
            .addComponents(agreeButton, declineButton);

        await interaction.editReply({
            embeds: [finalConfirmationEmbed],
            components: [buttonRow],
            ephemeral: true
        });

        const buttonFilter = i => ['confirm.taxi.agree', 'confirm.taxi.decline'].includes(i.customId) && i.user.id === interaction.user.id;
        const buttonResponse = await interaction.channel.awaitMessageComponent({ filter: buttonFilter, time: 120000 });

        await buttonResponse.deferUpdate();

        if (buttonResponse.customId === 'confirm.taxi.agree') {
            const successEmbed = new EmbedBuilder()
                .setTitle('Taxi Request Created! 🚀')
                .setDescription(`Your pilot will be in touch soon.\n\n**Pickup:** ${finalPickupString}\n**Destination:** ${finalDestinationString}`)
                .setColor(0x00FF00);

            await interaction.editReply({
                embeds: [successEmbed],
                components: [],
                ephemeral: true
            });
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

module.exports = { handleTouringCommand };