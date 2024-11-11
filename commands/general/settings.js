const { SlashCommandBuilder, ComponentType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { db } = require('../../bot');
const { settingsTemplate } = require('./settings.json')
const { setSetting, updateSetting, getSetting } = require('../../utility/dbHelper');

async function parseRole(inputString, guild) {
    // Regular expressions to extract the user and role mentions
    const userMentionRegex = /<@!?(\d+)>/;
    const roleMentionRegex = /<@&(\d+)>/;
  
    // Check if the input is a user mention
    const userMatch = inputString.match(userMentionRegex);
    if (userMatch) {
        const userId = userMatch[1];
        try {
            const user = await client.users.fetch(userId);
            return user ? user.username : `Unknown User (${userId})`;
        } catch (error) {
            console.error(`Could not fetch user with ID ${userId}:`, error);
            return `Unknown User (${userId})`;
        }
    }
  
    // Check if the input is a role mention
    const roleMatch = inputString.match(roleMentionRegex);
    if (roleMatch) {
        const roleId = roleMatch[1];
        const role = guild.roles.cache.get(roleId);
        return role ? role.name : `Unknown Role (${roleId})`;
    }
  
    return inputString;
}

async function parseEmojirole(inputString, guild) {
    console.log(inputString, guild);
    return "🧑‍✈️ -> Example-Role 1";
}

async function parseChannel(inputString, guild) {
    const channelMatch = inputString.match(/<#(\d+)>/);
    if (channelMatch) {
        const channelId = channelMatch[1];
        const channel = guild.channels.cache.get(channelId);
        return channel ? "#"+channel.name : `Unknown Channel (${channelId})`;
    }
    return inputString;
}

async function parsesetting(_value, _datatype, guild) {
    if (!_value) return;
    if (_datatype === 'bool') {
        return (_value === 'true');
    } else if (_datatype === 'int') {
        return parseInt(_value);
    } else if (_datatype === 'float') {
        return parseFloat(_value);
    } else if (_datatype === 'string') {
        return _value;
    } else if (_datatype === 'role') {
        var _result = await parseRole(_value, guild)
        return _result;
    } else if (_datatype === 'emojirole') {
        var _result = await parseEmojirole(_value, guild)
        return _result
    } else if (_datatype === 'channel') {
        var _result = await parseChannel(_value, guild)
        return _result;
    } else if (_datatype.startsWith('array[')) {
        const _arrtype = _datatype.substring(6, _datatype.length - 1);
        const results = await Promise.all(_value.split(' ').map(x => parsesetting(x, _arrtype, guild)));
        return results;
    }
}

async function renderPage(interaction, category, page=1) {
    var _strb = "";
    const row = new ActionRowBuilder()

    if (category == 'main' || category == 'back') {
        const mainMenuEmbed = new EmbedBuilder()
            .setColor(0x00FFFF)
            .setTitle(`Settings for "${interaction.guild.name}"`)
            .setDescription("Please select one of the following categories using the dropdown menu below:\n```🔷General\n   🔹General Settings of the bot\n\n🔷Management\n   🔹Settings for people managing the server\n\n🔷Roles\n   🔹Role settings including settings for mentions```");
    
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('general')
                .setLabel('General')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('management')
                .setLabel('Management')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('roles')
                .setLabel('Roles')
                .setStyle(ButtonStyle.Primary)
        );

        return { embeds: [mainMenuEmbed], components: [row] };
    }

    for (const [key, setting] of Object.entries(settingsTemplate[category].settings)) {
        const value = await parsesetting(await getSetting(db, interaction.guild.id, key), setting.dataType, interaction.guild);
        _strb += `\`\`\`${setting.friendlyName}: ${(!value) ? "unset" : value}\n\`\`\``;

        const button = new ButtonBuilder()
            .setCustomId(`change=${key}`)
            .setLabel(`Change ${setting.friendlyName}`)
            .setStyle(ButtonStyle.Secondary);
        
        row.addComponents(button); // Now you can add components to row
    }

    const settingsEmbed = new EmbedBuilder()
        .setColor(0xFF00FF)
        .setTitle(`${settingsTemplate[category].title} Settings`)
        .setDescription(`${settingsTemplate[category].description} \n` + _strb);

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [settingsEmbed], components: [row] };
}

async function handleButtonInteraction(interaction) {
    if (interaction.customId === 'general' || interaction.customId === 'management' || interaction.customId === 'role' || interaction.customId === 'back') {
        await interaction.update(await renderPage(interaction, interaction.customId));
    } else if (interaction.customId.startsWith('change=')) {
        const key = interaction.customId.split('=')[1];
        const currentValue = await getSetting(db, interaction.guild.id, key);

        datatype = "unknown"

        for (const [ikey, sietting] of Object.entries(settingsTemplate)) {
            for (const [jkey, jietting] of Object.entries(sietting)) {
                if (key == jkey) {
                    datatype = jietting.dataType;
                }
            }
        }

        await interaction.reply(`Current value for ${key} is "${currentValue}". Please provide a new value in form of the datatype ${datatype}.`);

        const filter = response => response.author.id === interaction.user.id;

        const collector = interaction.channel.createMessageCollector({ time: 60000 });

        collector.on('collect', async message => {
            parsedData = parseDatatypes(datatype, message.content)
            if (!parsedData) {
                interaction.followUp(`Invalid input, please provide a valid ${datatype} value.`);
                return;
            } else {
                await updateSetting(db, interaction, key, );
                collector.stop(); 
            }
        });
        
        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followUp('No response received, setting change cancelled.');
            }
        });
    }
}

function parseDatatypes (datatype, data) {
    var res;

    switch (datatype) {
        case 'bool':
            res = data.toLowerCase() === 'true' || data.toLowerCase() === 'false' ? data : null;
            break;
        case 'int':
            res = parseInt(data);
            break;
        case 'float':
            res = parseFloat(data);
            break;
        case 'string':
            res = data;
            break;
        case 'role':
            res = data;
            break;
        case 'emojirole':
            res = data;
            break;
        case 'channel':
            res = data;
            break;

        default:
            res = data;
            break;
    }
    console.log("parsed data: ", res);
    return res; 
}

function createCollector(message, interaction) {
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3_600_000 });

    collector.on('collect', async i => {
        try {
            await handleButtonInteraction(i); // Handle button clicks dynamically
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

        await interaction.editReply(await renderPage(interaction, 'main'));

        // Fetch the message and create the initial collector
        const message = await interaction.fetchReply();
        createCollector(message, interaction);
    },
};
