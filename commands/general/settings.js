const { SlashCommandBuilder, ComponentType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { db } = require('../../bot');
const { settingsTemplate } = require('./settings.json')
const { setSetting, updateSetting, getSetting } = require('../../utility/dbHelper');
const { checkPermission } = require('../../utility/checkpermission');
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
    console.log(inputString)
    return inputString.split('=')[0]
    //return "🧑‍✈️ -> Example-Role 1";
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

async function renderPage(interaction, category, page=0) {
    let copiedSettings = structuredClone(settingsTemplate);

    const settingsPerPage = 5;
    
    var _strb = "";
    const row1 = new ActionRowBuilder()
    const row2 = new ActionRowBuilder()
    const row3 = new ActionRowBuilder()
    const row4 = new ActionRowBuilder()
    
    const controlRow = new ActionRowBuilder()
    
    if (category == 'main' || category == 'back') {
        description = ""

        
        const row = new ActionRowBuilder()
        
        for (const [key, setting] of Object.entries(copiedSettings)) {
            row.addComponents(
                new ButtonBuilder()
                .setCustomId(key)
                .setLabel(setting.single)
                .setStyle(ButtonStyle.Primary)
            );
            description += `\`\`\`🔷${setting.single}\n   🔹${setting.description}\`\`\``
        }
        
        const mainMenuEmbed = new EmbedBuilder()
            .setColor(0x00FFFF)
            .setTitle(`Settings for "${interaction.guild.name}"`)
            .setDescription("Please select one of the following categories using the button menu below:\n"+description)
        return { embeds: [mainMenuEmbed], components: [row], ephemeral: true };
    }
    
    settingCount = Object.keys(copiedSettings[category].settings).length
    let pagesNeeded = ~~(settingCount/settingsPerPage)+((settingCount%settingsPerPage > 0)?1:0);
    
    if (settingCount > settingsPerPage) {
        copiedSettings[category].settings = Object.fromEntries(Object.entries(copiedSettings[category].settings).slice(0+settingsPerPage*page, settingsPerPage*(page+1)));
    }
    
    
    for (const [key, setting] of Object.entries(copiedSettings[category].settings)) {
        const value = await parsesetting(await getSetting(db, interaction.guild.id, key), setting.dataType, interaction.guild);
        _strb += `\`\`\`${setting.friendlyName}: ${(!value) ? "unset" : value}\n\`\`\``;
        
        const button = new ButtonBuilder()
            .setCustomId(`change=${key}`)
            .setLabel(`Change ${setting.friendlyName}`)
            .setStyle(ButtonStyle.Secondary);
            
        if (row1.components.length < 5) row1.addComponents(button);
        else if (row2.components.length < 5) row2.addComponents(button);
        else if (row3.components.length < 5) row3.addComponents(button);
        else if (row4.components.length < 5) row4.addComponents(button);
    }
    
    const settingsEmbed = new EmbedBuilder()
        .setColor(0xFF00FF)
        .setTitle(`${copiedSettings[category].title} Settings`)
        .setDescription(`${copiedSettings[category].description} \n` + _strb)
        .setFooter({ text: `Page ${page+1} of ${pagesNeeded}`});

    controlRow.addComponents(
        new ButtonBuilder()
            .setCustomId('back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`page_back?page=${page-1}?category=${category}`)
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled((page > 0) ? false : true),
        new ButtonBuilder()
            .setCustomId(`page_next?page=${page+1}?category=${category}`)
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled((page < pagesNeeded-1) ? false: true)
    );

    let rowsToReturn = [controlRow];
    if (row1.components.length > 0) rowsToReturn.push(row1);
    if (row2.components.length > 0) rowsToReturn.push(row2);
    if (row3.components.length > 0) rowsToReturn.push(row3);
    if (row4.components.length > 0) rowsToReturn.push(row4);

    return { embeds: [settingsEmbed], components: rowsToReturn, ephemeral: true };
}

async function handleButtonInteraction(interaction) {
    if (interaction.customId === 'general' || interaction.customId === 'management' || interaction.customId === 'role' || interaction.customId === 'back') {
        await interaction.update(await renderPage(interaction, interaction.customId));
    } else if (interaction.customId.startsWith('page')) {
        const page = parseInt(interaction.customId.split('?')[1].split('=')[1]);
        const category = interaction.customId.split('?')[2].split('=')[1];
        await interaction.update(await renderPage(interaction, category, page));
    } else if (interaction.customId.startsWith('change=')) {
        const key = interaction.customId.split('=')[1];
        const currentValue = await getSetting(db, interaction.guild.id, key);

        datatype = "unknown"

        for (const [ikey, sietting] of Object.entries(settingsTemplate)) {
            for (const [jkey, jietting] of Object.entries(sietting.settings)) {
                if (key == jkey) {
                    datatype = jietting.dataType;
                }
            }
        }

        var informDataMsg = await interaction.reply({ content: `Current value for ${key} is "${currentValue}". Please provide a new value in form of the datatype ${datatype}.`, ephemeral: true });

        const filter = response => response.author.id === interaction.user.id; 

        const collector = interaction.channel.createMessageCollector({ filter: filter, time: 60000 });

        collector.on('collect', async message => {
            parsedData = parseDatatypes(datatype, message.content)

            if (!parsedData) {
                interaction.followUp({ content: `Invalid input, please provide a valid ${datatype} value.`, ephemeral: true });
                return;
            } else {
                await updateSetting(db, interaction, key, parsedData, true);
                collector.stop(); 
            }

            message.delete();
        });
        
        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followUp({ content: 'No response received, setting change cancelled.', ephemeral: true });
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
    return res; 
}

function createCollector(message, interaction) {
    const collectorFilter = i => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, filter: collectorFilter, time: 3_600_000 });

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
        await interaction.deferReply({ephemeral: true});
        const haspermission = await checkPermission(db, interaction.user.id, interaction.guild.id, interaction.client);
        if (!haspermission) {
            return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        try {
            db.get('SELECT * FROM guilds WHERE guildid = ?', [interaction.guild.id], (err, row) => {
                if (err) {
                    console.error(err.message);
                    return interaction.editReply({ content: 'There was an error accessing the database.', ephemeral: true });
                }
                if (!row) {
                    db.run('INSERT INTO guilds(guildid) VALUES(?)', [interaction.guild.id], (err) => {
                        // TODO: Insert default settings
                        if (err) {
                            console.error(err.message);
                            return interaction.editReply({ content: 'There was an error accessing the database.', ephemeral: true });
                        }
                    });
                    return interaction.editReply({ content: 'No settings found for this guild.', ephemeral: true });
                }
            });
        } catch (error) {
            console.error('An error occurred while trying to access the database.', error);
            return interaction.editReply({ content: 'An error occurred while trying to access the database.', ephemeral: true });
        }

        await interaction.editReply(await renderPage(interaction, 'main'));

        // Fetch the message and create the initial collector
        const message = await interaction.fetchReply();
        createCollector(message, interaction);
    },
};
