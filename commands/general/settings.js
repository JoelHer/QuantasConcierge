const { SlashCommandBuilder, ComponentType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { db } = require('../../bot');

function getMainMenu(interaction) {
    const mainMenuEmbed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle(`Settings for "${interaction.guild.name}"`)
        .setDescription("Please select a category to edit.");
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('general')
            .setLabel('General Settings')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('roles')
            .setLabel('Role Settings')
            .setStyle(ButtonStyle.Primary)
    );

    return { embeds: [mainMenuEmbed], components: [row] };
}

function getGeneralSettingsMenu() {
    const generalSettingsEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('General Settings')
        .setDescription('Edit general bot settings here.');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('back')
            .setLabel('Back to Main Menu')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [generalSettingsEmbed], components: [row] };
}

function getRoleSettingsMenu() {
    const roleSettingsEmbed = new EmbedBuilder()
        .setColor(0xFF00FF)
        .setTitle('Role Settings')
        .setDescription('Edit role settings and permissions here.');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('back')
            .setLabel('Back to Main Menu')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [roleSettingsEmbed], components: [row] };
}

async function handleButtonInteraction(interaction) {
    if (interaction.customId === 'general') {
        await interaction.update(getGeneralSettingsMenu());
    } else if (interaction.customId === 'roles') {
        await interaction.update(getRoleSettingsMenu());
    } else if (interaction.customId === 'back') {
        await interaction.update(getMainMenu(interaction));
    }

    // Recreate a button collector after each update
    const message = await interaction.fetchReply();
    createCollector(message, interaction);
}

function createCollector(message, interaction) {
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3_600_000 });

    collector.on('collect', async i => {
        try {
            await handleButtonInteraction(i); // Handle button clicks dynamically
        } catch{}
    });

    collector.on('end', collected => {
        console.log(`Collected ${collected.size} interactions.`);
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Opens the settings menu.'),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            db.get('SELECT * FROM guilds WHERE guildid = ?', [interaction.guild.id], (err, row) => {
                if (err) {
                    console.error(err.message);
                    return interaction.editReply('There was an error accessing the database.');
                }
                if (!row) {
                    db.run('INSERT INTO guilds(guildid) VALUES(?)', [interaction.guild.id], (err) => {
                        if (err) {
                            console.error(err.message);
                            return interaction.editReply('There was an error accessing the database.');
                        }
                    });
                    return interaction.editReply('No settings found for this guild.');
                }
            });
        } catch (error) {
            console.error('An error occurred while trying to access the database.', error);
            return interaction.editReply('An error occurred while trying to access the database.');
        }

        await interaction.editReply(getMainMenu(interaction));

        // Fetch the message and create the initial collector
        const message = await interaction.fetchReply();
        createCollector(message, interaction);
        
    },
};
