// touring-helper.js
// Central handler for touring commands

const StarCitizenLocation = require('../../utility/data/location');
const locationData = new StarCitizenLocation;

async function handleTouringCommand(interaction) {
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
    const systems = locationData.getSystems();

    const embed = new EmbedBuilder()
        .setTitle('Pickup: Choose a Star System')
        .setDescription('To get started, please select a system from the dropdown menu below. This will help us assist you better with your request.')
        .setColor(0x00bfff);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('touring-system-picker')
        .setPlaceholder('Choose a system')
        .addOptions(
            systems.slice(0, 25).map(sys => ({
                label: sys,
                value: sys
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });

    const msg = await interaction.fetchReply();

    // Helper to show system picker
    async function showSystemPicker(i, msg) {
        await i.update({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
        // Restart collector for system
        startSystemCollector(msg);
    }

    // Helper to show planet picker
    async function showPlanetPicker(i, selectedSystem, msg) {
        const planets = locationData.getPlanets(selectedSystem);
        const planetEmbed = new EmbedBuilder()
            .setTitle('Pickup: Choose a Planet')
            .setDescription(`System **${selectedSystem}**. Please choose a Planet:`)
            .setColor(0x00bfff);
        const planetMenu = new StringSelectMenuBuilder()
            .setCustomId('touring-planet-picker')
            .setPlaceholder('Choose a planet')
            .addOptions(
                planets.slice(0, 25).map(p => ({ label: p, value: p }))
            );
        const planetRow = new ActionRowBuilder().addComponents(planetMenu);
        const backButton = new ButtonBuilder()
            .setCustomId('back-to-system')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);
        const buttonRow = new ActionRowBuilder().addComponents(backButton);
        await i.update({
            embeds: [planetEmbed],
            components: [planetRow, buttonRow],
            ephemeral: true
        });
        startPlanetCollector(selectedSystem, planetEmbed, planetRow, buttonRow, msg);
    }

    // Helper to show moon picker
    async function showMoonPicker(i, selectedSystem, selectedPlanet, msg) {
        const moons = locationData.getMoons(selectedSystem, selectedPlanet);
        const moonEmbed = new EmbedBuilder()
            .setTitle('Pickup: Choose a Moon (optional)')
            .setDescription(`System **${selectedSystem}**, planet **${selectedPlanet}**.\nYou can select a moon or just confirm the planet as your destination.`)
            .setColor(0x00bfff);
        const moonMenu = new StringSelectMenuBuilder()
            .setCustomId('touring-moon-picker')
            .setPlaceholder('Choose a moon or select the planet')
            .addOptions([
                { label: `Just the planet (${selectedPlanet})`, value: '__planet__' },
                ...moons.slice(0, 24).map(m => ({ label: m, value: m }))
            ]);
        const moonRow = new ActionRowBuilder().addComponents(moonMenu);
        const backButton = new ButtonBuilder()
            .setCustomId('back-to-planet')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);
        const buttonRow = new ActionRowBuilder().addComponents(backButton);
        await i.update({
            embeds: [moonEmbed],
            components: [moonRow, buttonRow],
            ephemeral: true
        });
        startMoonCollector(selectedSystem, selectedPlanet, moonEmbed, moonRow, buttonRow, msg);
    }

    // System collector
    function startSystemCollector(msg) {
        const systemCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: i => i.user.id === interaction.user.id && i.customId === 'touring-system-picker',
            time: 60_000,
            max: 1
        });
        systemCollector.on('collect', async i => {
            const selectedSystem = i.values[0];
            showPlanetPicker(i, selectedSystem, msg);
        });
        systemCollector.on('end', (collected) => {
            if (collected.size === 0) {
                msg.edit({
                    embeds: [
                        EmbedBuilder.from(embed)
                            .setDescription('Oops! Time ran out for selecting a system. Be faster next time! :P')
                    ],
                    components: [],
                    ephemeral: true
                }).catch(() => {});
            }
        });
    }

    // Planet collector
    function startPlanetCollector(selectedSystem, planetEmbed, planetRow, buttonRow, msg) {
        const planetCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: pi => pi.user.id === interaction.user.id && pi.customId === 'touring-planet-picker',
            time: 60_000,
            max: 1
        });
        const backCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: btn => btn.user.id === interaction.user.id && btn.customId === 'back-to-system',
            time: 60_000,
            max: 1
        });
        planetCollector.on('collect', async pi => {
            const selectedPlanet = pi.values[0];
            const moons = locationData.getMoons(selectedSystem, selectedPlanet);
            if (!moons.length) {
                await pi.update({
                    embeds: [
                        EmbedBuilder.from(planetEmbed)
                            .setDescription(`System **${selectedSystem}** and planet **${selectedPlanet}** chosen. No moons available.`)
                    ],
                    components: [],
                    ephemeral: true
                });
                return;
            }
            showMoonPicker(pi, selectedSystem, selectedPlanet, msg);
        });
        backCollector.on('collect', async btn => {
            showSystemPicker(btn, msg);
        });
        planetCollector.on('end', (collected) => {
            if (collected.size === 0) {
                msg.edit({
                    embeds: [
                        EmbedBuilder.from(planetEmbed)
                            .setDescription('Oops! Time ran out for selecting a planet. Be faster next time! :P')
                    ],
                    components: [],
                    ephemeral: true
                }).catch(() => {});
            }
        });
    }

    // Moon collector
    function startMoonCollector(selectedSystem, selectedPlanet, moonEmbed, moonRow, buttonRow, msg) {
        const moonCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: mi => mi.user.id === interaction.user.id && mi.customId === 'touring-moon-picker',
            time: 60_000,
            max: 1
        });
        const backCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: btn => btn.user.id === interaction.user.id && btn.customId === 'back-to-planet',
            time: 60_000,
            max: 1
        });
        moonCollector.on('collect', async mi => {
            const selectedMoon = mi.values[0];
            let pickupDesc;
            if (selectedMoon === '__planet__') {
                pickupDesc = `System **${selectedSystem}**, planet **${selectedPlanet}**`;
            } else {
                pickupDesc = `System **${selectedSystem}**, planet **${selectedPlanet}**, moon **${selectedMoon}**`;
            }
            // Start delivery location picker (three-step, same as pickup)
            await showDeliverySystemPicker(mi, pickupDesc, msg);
        });
        backCollector.on('collect', async btn => {
            showPlanetPicker(btn, selectedSystem, msg);
        });
        moonCollector.on('end', (collected) => {
            if (collected.size === 0) {
                msg.edit({
                    embeds: [
                        EmbedBuilder.from(moonEmbed)
                            .setDescription('Oops! Time ran out for selecting a moon or confirming the planet.')
                    ],
                    components: [],
                    ephemeral: true
                }).catch(() => {});
            }
        });
    }

    // Delivery location pickers (three-step, same as pickup)
    async function showDeliverySystemPicker(i, pickupDesc, msg) {
        const deliverySystems = locationData.getSystems();
        const deliveryEmbed = new EmbedBuilder()
            .setTitle('Dropoff: Choose a System')
            .setDescription('Where do you want to be delivered? Please select the system for your delivery location.')
            .setColor(0x00bfff);
        const deliverySystemMenu = new StringSelectMenuBuilder()
            .setCustomId('delivery-system-picker')
            .setPlaceholder('Choose a system')
            .addOptions(
                deliverySystems.slice(0, 25).map(sys => ({ label: sys, value: sys }))
            );
        const deliverySystemRow = new ActionRowBuilder().addComponents(deliverySystemMenu);
        await i.update({
            embeds: [deliveryEmbed],
            components: [deliverySystemRow],
            ephemeral: true
        });
        startDeliverySystemCollector(pickupDesc, deliveryEmbed, deliverySystemRow, msg);
    }

    function startDeliverySystemCollector(pickupDesc, deliveryEmbed, deliverySystemRow, msg) {
        const systemCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: i => i.user.id === interaction.user.id && i.customId === 'delivery-system-picker',
            time: 60_000,
            max: 1
        });
        systemCollector.on('collect', async i => {
            const selectedSystem = i.values[0];
            showDeliveryPlanetPicker(i, pickupDesc, selectedSystem, msg);
        });
        systemCollector.on('end', (collected) => {
            if (collected.size === 0) {
                msg.edit({
                    embeds: [
                        EmbedBuilder.from(deliveryEmbed)
                            .setDescription('Oops! Time ran out for selecting a delivery system.')
                    ],
                    components: [],
                    ephemeral: true
                }).catch(() => {});
            }
        });
    }

    async function showDeliveryPlanetPicker(i, pickupDesc, selectedSystem, msg) {
        const planets = locationData.getPlanets(selectedSystem);
        const planetEmbed = new EmbedBuilder()
            .setTitle('Dropoff: Choose a Planet')
            .setDescription(`System **${selectedSystem}**. Please choose a planet for your delivery location:`)
            .setColor(0x00bfff);
        const planetMenu = new StringSelectMenuBuilder()
            .setCustomId('delivery-planet-picker')
            .setPlaceholder('Choose a planet')
            .addOptions(
                planets.slice(0, 25).map(p => ({ label: p, value: p }))
            );
        const planetRow = new ActionRowBuilder().addComponents(planetMenu);
        const backButton = new ButtonBuilder()
            .setCustomId('back-to-delivery-system')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);
        const buttonRow = new ActionRowBuilder().addComponents(backButton);
        await i.update({
            embeds: [planetEmbed],
            components: [planetRow, buttonRow],
            ephemeral: true
        });
        startDeliveryPlanetCollector(pickupDesc, selectedSystem, planetEmbed, planetRow, buttonRow, msg);
    }

    function startDeliveryPlanetCollector(pickupDesc, selectedSystem, planetEmbed, planetRow, buttonRow, msg) {
        const planetCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: pi => pi.user.id === interaction.user.id && pi.customId === 'delivery-planet-picker',
            time: 60_000,
            max: 1
        });
        const backCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: btn => btn.user.id === interaction.user.id && btn.customId === 'back-to-delivery-system',
            time: 60_000,
            max: 1
        });
        planetCollector.on('collect', async pi => {
            const selectedPlanet = pi.values[0];
            const moons = locationData.getMoons(selectedSystem, selectedPlanet);
            if (!moons.length) {
                // No moons, finish with this planet
                await showDisclaimer(pi, pickupDesc, `System **${selectedSystem}**, planet **${selectedPlanet}**`, msg);
                return;
            }
            showDeliveryMoonPicker(pi, pickupDesc, selectedSystem, selectedPlanet, msg);
        });
        backCollector.on('collect', async btn => {
            showDeliverySystemPicker(btn, pickupDesc, msg);
        });
        planetCollector.on('end', (collected) => {
            if (collected.size === 0) {
                msg.edit({
                    embeds: [
                        EmbedBuilder.from(planetEmbed)
                            .setDescription('Oops! Time ran out for selecting a delivery planet.')
                    ],
                    components: [],
                    ephemeral: true
                }).catch(() => {});
            }
        });
    }

    async function showDeliveryMoonPicker(i, pickupDesc, selectedSystem, selectedPlanet, msg) {
        const moons = locationData.getMoons(selectedSystem, selectedPlanet);
        const moonEmbed = new EmbedBuilder()
            .setTitle('Dropoff: Choose a Moon (optional)')
            .setDescription(`System **${selectedSystem}**, planet **${selectedPlanet}**.\nYou can select a moon or just confirm the planet as your delivery location.`)
            .setColor(0x00bfff);
        const moonMenu = new StringSelectMenuBuilder()
            .setCustomId('delivery-moon-picker')
            .setPlaceholder('Choose a moon or select the planet')
            .addOptions([
                { label: `Just the planet (${selectedPlanet})`, value: '__planet__' },
                ...moons.slice(0, 24).map(m => ({ label: m, value: m }))
            ]);
        const moonRow = new ActionRowBuilder().addComponents(moonMenu);
        const backButton = new ButtonBuilder()
            .setCustomId('back-to-delivery-planet')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);
        const buttonRow = new ActionRowBuilder().addComponents(backButton);
        await i.update({
            embeds: [moonEmbed],
            components: [moonRow, buttonRow],
            ephemeral: true
        });
        startDeliveryMoonCollector(pickupDesc, selectedSystem, selectedPlanet, moonEmbed, moonRow, buttonRow, msg);
    }

    function startDeliveryMoonCollector(pickupDesc, selectedSystem, selectedPlanet, moonEmbed, moonRow, buttonRow, msg) {
        const moonCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: mi => mi.user.id === interaction.user.id && mi.customId === 'delivery-moon-picker',
            time: 60_000,
            max: 1
        });
        const backCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: btn => btn.user.id === interaction.user.id && btn.customId === 'back-to-delivery-planet',
            time: 60_000,
            max: 1
        });
        moonCollector.on('collect', async mi => {
            const selectedMoon = mi.values[0];
            let deliveryDesc;
            if (selectedMoon === '__planet__') {
                deliveryDesc = `System **${selectedSystem}**, planet **${selectedPlanet}**`;
            } else {
                deliveryDesc = `System **${selectedSystem}**, planet **${selectedPlanet}**, moon **${selectedMoon}**`;
            }
            await showDisclaimer(mi, pickupDesc, deliveryDesc, msg);
        });
        backCollector.on('collect', async btn => {
            showDeliveryPlanetPicker(btn, pickupDesc, selectedSystem, msg);
        });
        moonCollector.on('end', (collected) => {
            if (collected.size === 0) {
                msg.edit({
                    embeds: [
                        EmbedBuilder.from(moonEmbed)
                            .setDescription('Oops! Time ran out for selecting a delivery moon or confirming the planet.')
                    ],
                    components: [],
                    ephemeral: true
                }).catch(() => {});
            }
        });
    }

    // Show disclaimer with both pickup and delivery
    async function showDisclaimer(i, pickupDesc, deliveryDesc, msg) {
        const disclaimerEmbed = new EmbedBuilder()
            .setTitle('Disclaimer')
            .setDescription(
                `**From:** ${pickupDesc} **To:** ${deliveryDesc}` +
                '\n\n**Disclaimer:**\nBy requesting a pickup, you acknowledge that in-game assistance is provided by volunteers and there is no guarantee of success or safety. Furthermore, it can take up to 10 minutes for an employee to accept your request and start the pickup process. After an employee accepts your request, you have to confirm the request one more time, before the process starts. Please be patient and do not spam requests.\n **Do you accept the Terms and Conditions?**'
            )
            .setColor(0xffa500);
        const acceptButton = new ButtonBuilder()
            .setCustomId('disclaimer-accept')
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success);
        const declineButton = new ButtonBuilder()
            .setCustomId('disclaimer-decline')
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger);
        const disclaimerRow = new ActionRowBuilder().addComponents(acceptButton, declineButton);
        await i.update({
            embeds: [disclaimerEmbed],
            components: [disclaimerRow],
            ephemeral: true
        });
        const disclaimerCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: btn => btn.user.id === interaction.user.id && (btn.customId === 'disclaimer-accept' || btn.customId === 'disclaimer-decline'),
            time: 60_000,
            max: 1
        });
        disclaimerCollector.on('collect', async btn => {
            if (btn.customId === 'disclaimer-accept') {
                await btn.update({
                    embeds: [
                        EmbedBuilder.from(disclaimerEmbed).setDescription(
                            `**From:** ${pickupDesc} **To:** ${deliveryDesc}` +
                            '\n\nThank you! Your request has been accepted and will be processed.'
                        )
                    ],
                    components: [],
                    ephemeral: true
                });
            } else {
                await btn.update({
                    embeds: [
                        EmbedBuilder.from(disclaimerEmbed).setDescription(
                            '\n\nYou have declined the disclaimer. The request has been cancelled.'
                        )
                    ],
                    components: [],
                    ephemeral: true
                });
            }
        });
        disclaimerCollector.on('end', (collected) => {
            if (collected.size === 0) {
                msg.edit({
                    embeds: [
                        EmbedBuilder.from(disclaimerEmbed)
                            .setDescription(
                                '\n\nYou did not respond to the disclaimer in time. The command has been cancelled.'
                            )
                    ],
                    components: [],
                    ephemeral: true
                }).catch(() => {});
            }
        });
    }

    // Start the first collector
    startSystemCollector(msg);
}

module.exports = { handleTouringCommand };
