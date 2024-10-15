const { SlashCommandBuilder, ComponentType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { db } = require('../../bot');
const { settingsTemplate } = require('./settings.json')
const { setSetting, getSetting } = require('../../utility/dbHelper');

function getMainMenu(interaction) {
    const mainMenuEmbed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle(`Settings for "${interaction.guild.name}"`)
        .setDescription("Please select one of the following categories using the dropdown menu below:\n```🔷General\n   🔹General Settings of the bot\n🔷Roles\n   🔹Role settings including settings for mentions```");
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('general')
            .setLabel('General')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('roles')
            .setLabel('Roles')
            .setStyle(ButtonStyle.Primary)
    );

    return { embeds: [mainMenuEmbed], components: [row] };
}

function getGeneralSettingsMenu(interaction) {
    var _strb = "";

    // Create an array of promises
    const promises = [];

    for (const [key, value] of Object.entries(settingsTemplate.general)) {
        _strb += `${key}: ${value}\n`;

        // Add the promise to the array and handle the response
        promises.push(
            getSetting(db, interaction.guild.id, key).then((settingValue) => {
                console.log(settingValue);
                // Optionally append the retrieved setting value to _strb
                _strb += `Setting: ${settingValue}\n`;
            })
        );
    }

    // Wait for all promises to complete
    return Promise.all(promises).then(() => {
        const generalSettingsEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('General Settings')
            .setDescription('Edit general bot settings here.\n' + _strb);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('back')
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary)
        );

        return { embeds: [generalSettingsEmbed], components: [row] };
    });
}


function getRoleSettingsMenu(interaction) {
    const roleSettingsEmbed = new EmbedBuilder()
        .setColor(0xFF00FF)
        .setTitle('Role Settings')
        .setDescription('Edit role settings and permissions here.');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [roleSettingsEmbed], components: [row] };
}

async function handleButtonInteraction(interaction) {
    if (interaction.customId === 'general') {
        await interaction.update(getGeneralSettingsMenu(interaction));
    } else if (interaction.customId === 'roles') {
        await interaction.update(getRoleSettingsMenu(interaction));
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
        } catch (_err){
            console.log(_err)
        }
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
