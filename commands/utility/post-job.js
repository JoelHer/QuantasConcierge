const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { getSetting } = require('../../utility/dbHelper');
const { db } = require('../../bot');
const { v4: uuidv4 } = require('uuid');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('post-job')
		.setDescription('Post a job in this channel.')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Title of the post')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description of the post')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to post in')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('timestamp')
                .setDescription('Used to schedule the event for internal purposes. The format is unix timestamp as a number.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Sets the color of the embed in hex. Default is 0x0099FF')
                .setRequired(false)),
    async execute(interaction) {
        const _roles = await getSetting(db, interaction.guild.id, 'job-mention');

        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const color = interaction.options.getString('color');
        const channel = interaction.options.getChannel('channel');
        const timestamp = interaction.options.getNumber('timestamp');

        // If the user has a nickname, use that instead of their username TODO: Fix it to user the proper displayed name.
        const name = (interaction.member.nickname)?(interaction.member.nickname):(interaction.member.displayName)


        // Ensure the selected channel is a text-based channel
        if (!channel.isTextBased()) {
            await interaction.reply('Please select a valid text channel.');
            return;
        }


        const exampleEmbed = new EmbedBuilder()
            .setColor((color === null) ? 0x0099FF : color)
            .setTitle(title)
            .setAuthor({ name: 'Quantas Starlines', iconURL: 'https://cdn.discordapp.com/avatars/1295043243641274378/5bf928c18697f98d5131022c3d3b9454?size=256' })
            .setDescription(description)
            .addFields(
                { name: 'Able to/interested to participate?', value: 'React below with the roles you could fulfil (🧑🏻‍✈️ for pilot, 🪠 for escort, 🔫 for onboard security, 🍾 for bartender and react with both your role and with ❔ emoji for maybe). Only react with roles that you are trained for (roles that you also have in the discord)!\n'+((_roles)? _roles:" ")},
            )
            .setImage('https://media.discordapp.net/attachments/1070062643055964241/1288236074929225760/marcel-van-vuuren-aaron-halo-web-01.png?ex=670e2816&is=670cd696&hm=01a7d7435f53bb567f0b6b268c9c3c07cfe1d28acfc732ca67f74b59d82a78ec&=&format=webp&quality=lossless&width=1100&height=424')
            .setTimestamp()
            .setFooter({ text: 'Posted by '+name, iconURL: interaction.user.avatarURL() });

        
        // Create the buttons
        const confirm = new ButtonBuilder()
            .setCustomId('confirm')
            .setLabel('Publish')
            .setStyle(ButtonStyle.Success);

        const cancel = new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        // The row where all the buttons sit
        const row = new ActionRowBuilder()
	        .addComponents(confirm, cancel);

        // Reply to confirm the job post
        const response = await interaction.reply({content:'Here is a preview of the post. Click the send or the discard button', components: [row], embeds: [exampleEmbed], ephemeral: true });
        
        //button logic
        try {
            try {
                const confirmation = await response.awaitMessageComponent({ time: 60_000 });
                if (confirmation.customId === 'confirm') {
                    const message = await channel.send({ embeds: [exampleEmbed] });
                    await interaction.editReply({ content: 'Sending Message...', components: [], embeds: [], ephemeral: true });
                    await message.react('🧑‍✈️');
                    await message.react('🪠');
                    await message.react('🔫');
                    await message.react('🍾');
                    await message.react('❔');

                    let uuid = uuidv4()
                    db.run(`INSERT INTO events (uuid, guildid, title, description, timestamp) VALUES (?, ?, ?, ?, ?)`, [uuid, interaction.guild.id, title, description, timestamp], function (err, row) {
                        if (err) {
                            console.error(err.message);
                        } else {
                            db.run(`INSERT INTO announcements (type, guildid, messageid, channelid, eventuuid) VALUES ("EMPLOYEE_JOBPOST",?, ?, ?, ?)`, [interaction.guild.id, message.id, message.channel.id, uuid], function (err, row) {
                                if (err) {
                                    console.error(err.message);
                                } 
                                console.log(typeof(interaction))
                                getSetting(db, interaction.guild.id, 'management_updates_channel').then((val) => {
                                    if (val) {
                                        const channel = interaction.guild.channels.cache.get(val.replace(/[<#>]/g, ""));
                                        if (channel) {
                                            channel.send({ content: 'CHANGE ME TO EMBED \n# New job posted in <#'+message.channel.id+'>' });
                                        }
                                    } else {
                                        interaction.followUp({ content: 'Event has been posted successfully. Where do you want to receive updates? This preference will be saved for future posts and can be edited with /settings in the management menu.', components: [], embeds: [], ephemeral: true });
                                    }
                                })
                                
                            });
                        }
                    });
                } else if (confirmation.customId === 'cancel') {
                    await confirmation.update({ content: 'Action cancelled', components: [], embeds: [] });
                }
            } catch (e) { 
                // TODO: this throws some error for some reason
            }
        } catch (e) {
            await interaction.editReply({ content: 'Confirmation not received within 1 minute, cancelling. ' + e, components: [], embeds: [] });
        }
    },
};
