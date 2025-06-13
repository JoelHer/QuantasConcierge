// touring-helper.js
// Central handler for touring commands

const StarCitizenLocation = require('../../utility/data/location');
const locationData = new StarCitizenLocation;

async function handleTouringCommand(interaction) {
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
    const systems = locationData.getSystems();

    const embed = new EmbedBuilder()
        .setTitle('Choose a Star System')
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

    // Collector for system selection
    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === interaction.user.id && i.customId === 'touring-system-picker',
        time: 60_000,
        max: 1
    });

    collector.on('collect', async i => {
        const selectedSystem = i.values[0];
        const planets = locationData.getPlanets(selectedSystem);
        if (!planets.length) {
            await i.update({
                embeds: [
                    EmbedBuilder.from(embed)
                        .setDescription(`No planets found in the system **${selectedSystem}**. This might be a bug, please report it.`)
                ],
                components: [],
                ephemeral: true
            });
            return;
        }
        const planetEmbed = new EmbedBuilder()
            .setTitle('Choose a Planet')
            .setDescription(`System **${selectedSystem}**. Please choose a Planet:`)
            .setColor(0x00bfff);
        const planetMenu = new StringSelectMenuBuilder()
            .setCustomId('touring-planet-picker')
            .setPlaceholder('Choose a planet')
            .addOptions(
                planets.slice(0, 25).map(p => ({ label: p, value: p }))
            );
        const planetRow = new ActionRowBuilder().addComponents(planetMenu);
        await i.update({
            embeds: [planetEmbed],
            components: [planetRow],
            ephemeral: true
        });
        // Collector for planet selection
        const planetCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: pi => pi.user.id === interaction.user.id && pi.customId === 'touring-planet-picker',
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
            // Add option to just select the planet
            const moonEmbed = new EmbedBuilder()
                .setTitle('Choose a Moon (optional)')
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
            await pi.update({
                embeds: [moonEmbed],
                components: [moonRow],
                ephemeral: true
            });
            // Collector for moon selection
            const moonCollector = msg.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: mi => mi.user.id === interaction.user.id && mi.customId === 'touring-moon-picker',
                time: 60_000,
                max: 1
            });
            moonCollector.on('collect', async mi => {
                const selectedMoon = mi.values[0];
                let desc;
                if (selectedMoon === '__planet__') {
                    desc = `System **${selectedSystem}**, planet **${selectedPlanet}** chosen.`;
                } else {
                    desc = `System **${selectedSystem}**, planet **${selectedPlanet}**, moon **${selectedMoon}** chosen.`;
                }
                await mi.update({
                    embeds: [
                        EmbedBuilder.from(moonEmbed).setDescription(desc)
                    ],
                    components: [],
                    ephemeral: true
                });
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
    });
    collector.on('end', (collected) => {
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

module.exports = { handleTouringCommand };
