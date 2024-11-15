const { SlashCommandBuilder, ComponentType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../bot');

async function renderEvents(interaction, events, page=0) {
    const eventsPerPage = 5;

    eventCount = events.length
    let pagesNeeded = ~~(eventCount/eventsPerPage)+((eventCount%eventsPerPage > 0)?1:0);

    splicedEvents = []
    if (eventCount > eventsPerPage) {
        splicedEvents = events.slice(page*eventsPerPage, eventsPerPage*(page+1));
    } else {
        splicedEvents = events;
    }

    descr = ""
    if (splicedEvents.length === 0) {
        descr = "### No upcoming events.";
        pagesNeeded = 1;
    }
    splicedEvents.forEach(event => {
        descr += `### ${event.title}\n${event.description}\nLength: ? Hours, When? <t:${event.timestamp}:F>\n`;
    });

    const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(`## Upcoming events:\n${descr}`)
        .setFooter({ text: `Page ${page+1} of ${pagesNeeded}`});

    const controlRow = new ActionRowBuilder();
    controlRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`page_back?page=${page-1}`)
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled((page > 0) ? false : true),
        new ButtonBuilder()
            .setCustomId(`page_next?page=${page+1}}`)
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled((page < pagesNeeded-1) ? false: true)
    );

    return { embeds: [embed], components: [controlRow], ephemeral: true };
}

async function handleButtonInteraction(interaction) {
    if (interaction.customId.startsWith('page')) {
        const page = parseInt(interaction.customId.split('?')[1].split('=')[1]);
        timestamp = Math.floor(Date.now() / 1000);
        db.all(`SELECT * FROM events WHERE timestamp > ?;`, [timestamp], async (err, rows) => {
            await interaction.update(await renderEvents(interaction, rows, page));
        })
    }
}

function createCollector(message, interaction) {
    const collectorFilter = i => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, filter: collectorFilter, time: 3_600_000 });

    collector.on('collect', async i => {
        try {
            await handleButtonInteraction(i); 
        } catch (_err){
            console.log(_err);
        }
    });

    collector.on('end', collected => {
        console.log(`Collected ${collected.size} interactions.`);
    });
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('events')
		.setDescription('List all events'),
	async execute(interaction) {
		await interaction.deferReply({ephemeral: true});
        const timestamp = Math.floor(Date.now() / 1000);
        db.all(`SELECT * FROM events WHERE timestamp > ?;`, [timestamp], async (err, rows) => {
            await interaction.editReply(await renderEvents(interaction, rows));
            
            const message = await interaction.fetchReply();
            createCollector(message, interaction);
        })
	},
};
