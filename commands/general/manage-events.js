const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../bot');

// Wrap database queries in Promises
function fetchEvents(query, params) {
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
        const rows = await fetchEvents(`SELECT * FROM events WHERE uuid = ?;`, [event_uuid]);

        if (!rows || rows.length === 0) {
            console.error('No event found for UUID:', event_uuid);
            return;
        }

        const row = rows[0];
        const embed = new EmbedBuilder()
            .setColor(0xFFFFFF)
            .setDescription(`## Event : ${row.title}`)
            .setFooter({ text: `${event_uuid}; This embed doesn't update automatically.` });

        controlRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`back`)
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary)
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

        const controlRow2 = new ActionRowBuilder().addComponents(select);

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

        return { embeds: [embed], components: [controlRow, controlRow2], ephemeral: true };
    }
}

// Handle button interactions
async function handleButtonInteraction(interaction) {
    const timestamp = Math.floor(Date.now() / 1000);

    try {
        if (interaction.customId === 'back') {
            const rows = await fetchEvents(`SELECT * FROM events WHERE timestamp > ? ORDER BY timestamp ASC;`, [timestamp]);
            await interaction.update(await renderEvents(interaction, rows));
        } else if (interaction.customId.startsWith('select_event')) {
            await interaction.update(await renderEvents(interaction, undefined));
        } else if (interaction.customId.startsWith('page')) {
            const page = parseInt(interaction.customId.split('?')[1].split('=')[1], 10);
            const rows = await fetchEvents(`SELECT * FROM events WHERE timestamp > ? ORDER BY timestamp ASC;`, [timestamp]);
            await interaction.update(await renderEvents(interaction, rows, page));
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
            const rows = await fetchEvents(`SELECT * FROM events WHERE timestamp > ? ORDER BY timestamp ASC;`, [timestamp]);

            await interaction.editReply(await renderEvents(interaction, rows));

            const message = await interaction.fetchReply();
            createCollector(message, interaction);
        } catch (err) {
            console.error('Command execution error:', err);
            await interaction.followUp({ content: 'There was an error executing this command.', ephemeral: true });
        }
    },
};
