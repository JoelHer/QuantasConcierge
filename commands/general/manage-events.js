const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../bot');

async function renderEvents(interaction, events, page=0) {
    const controlRow = new ActionRowBuilder();

    if (interaction.customId && interaction.customId.startsWith('select_event')) {
        const event_uuid = interaction.values[0].split('=')[1];
        row = rows[0];
        const embed = new EmbedBuilder()
            .setColor(0xFFFFFF)
            .setDescription(`## Event : ${row.title}`)
            .setFooter({ text: `${event_uuid}; This embed is doesn't update automatically.`});
        controlRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`back`)
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary)
        )
        return { embeds: [embed], components: [controlRow], ephemeral: true };
    

    };

    const eventsPerPage = 2;

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
        descr = "### No upcoming events to manage.";
        pagesNeeded = 1;
    }
    const select = new StringSelectMenuBuilder()
        .setCustomId('select_event')
        .setPlaceholder('Make a selection!')
        
    splicedEvents.forEach(event => {
        descr += `### ${event.title}\n${event.description}\nLength: ? Hours, When? <t:${event.timestamp}:F>\n`;
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(event.title)
                .setDescription("Event uuid: "+event.uuid)
                .setValue("uuid="+event.uuid)
        );
    });

    const embed = new EmbedBuilder()
        .setColor(0xFFFFFF)
        .setDescription(`## Select upcoming Event:\n${descr}`)
        .setFooter({ text: `Page ${page+1} of ${pagesNeeded}`});

    const controlRow2 = new ActionRowBuilder();

    controlRow2.addComponents(
        select
    )

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

    return { embeds: [embed], components: [controlRow, controlRow2], ephemeral: true };
}

async function handleButtonInteraction(interaction) {
    timestamp = Math.floor(Date.now() / 1000);
    if (interaction.customId === 'back') {
        db.all(`SELECT * FROM events WHERE timestamp > ? ORDER BY timestamp ASC;`, [timestamp], async (err, rows) => {
            await interaction.update(await renderEvents(interaction, rows));
        })
    } if (interaction.customId.startsWith('select_event')) {
        await interaction.update(await renderEvents(interaction, undefined));
    } if (interaction.customId.startsWith('page')) {
        const page = parseInt(interaction.customId.split('?')[1].split('=')[1]);
        db.all(`SELECT * FROM events WHERE timestamp > ? ORDER BY timestamp ASC;`, [timestamp], async (err, rows) => {
            await interaction.update(await renderEvents(interaction, rows, page));
        })
    }
}

function createCollector(message, interaction) {
    const collectorFilter = i => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ filter: collectorFilter, time: 3_600_000 });

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
		.setName('manage-events')
		.setDescription('Event Management'),
	async execute(interaction) {
		await interaction.deferReply({ephemeral: true});
        const timestamp = Math.floor(Date.now() / 1000);
        db.all(`SELECT * FROM events WHERE timestamp > ? ORDER BY timestamp ASC;`, [timestamp], async (err, rows) => {
            await interaction.editReply(await renderEvents(interaction, rows));
            
            const message = await interaction.fetchReply();
            createCollector(message, interaction);
        })
	},
};
