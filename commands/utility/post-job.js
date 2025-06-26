const { checkPermission } = require('../../utility/checkpermission');
const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const { getSetting } = require('../../utility/dbHelper');
const { handleMessage, buildEventManagerMessage } = require('../../utility/jobpost-reaction');
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
        .addNumberOption(option =>
            option.setName('timestamp')
                .setDescription('Used to schedule the event for internal purposes. The format is unix timestamp as a number.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Sets the color of the embed in hex. Default is 0x0099FF')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('imageurl')
                .setDescription('Sets the image of the embed')
                .setRequired(false)),
    
    async execute(interaction) {
        const haspermission = await checkPermission(db, interaction.user.id, interaction.guild.id, interaction.client);
        if (!haspermission) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const _roles = await getSetting(db, interaction.guild.id, 'job-mention');

        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const color = interaction.options.getString('color');
        const imageurl = interaction.options.getString('imageurl');
        const timestamp = interaction.options.getNumber('timestamp');

        // If the user has a nickname, use that instead of their username TODO: Fix it to user the proper displayed name.
        const name = (interaction.member.nickname)?(interaction.member.nickname):(interaction.member.displayName)

        var job_post_channel_raw = await getSetting(db, interaction.guild.id, "job_post_channel");
        var management_updates_channel = await getSetting(db, interaction.guild.id, "management_updates_channel");
        
        if (!job_post_channel_raw) {
            await interaction.reply({ content:'No job post channel set. Please set one with /settings in the category "Management".', ephemeral: true });
            return;
        }
        
        if (!management_updates_channel) {
            await interaction.reply({ content:'No management channel set. Please set one with /settings in the category "Management".', ephemeral: true });
            return;
        }
        
        job_post_channel_raw = job_post_channel_raw.replace("<#", "").replace(">", "")
        management_updates_channel = management_updates_channel.replace("<#", "").replace(">", "")
        
        //fetch channel
        let channel;
        try {
            channel = interaction.guild.channels.cache.get(job_post_channel_raw);
        } catch (e) {
            await interaction.reply({ content:'The channel you provided to post the job is not a valid channel. Please set a valid text channel with /settings in the category "Management".', ephemeral: true });
            return;
        }

        try {
            var channel2 = interaction.guild.channels.cache.get(management_updates_channel);
        } catch (e) {
            await interaction.reply({ content:'The channel you provided to post management message is not a valid channel. Please set a valid text channel with /settings in the category "Management".', ephemeral: true });
            return;
        }



        try {
        if (!channel.isTextBased() || !channel2.isTextBased()) {
            await interaction.reply({ content:'The channel you provided is not a text channel. Please set a text channel with /settings in the category "Management".', ephemeral: true });
                return;
            }
        } catch (e) {
            await interaction.reply({ content:'The channel you provided isnt a text channel. Please set a text channel with /settings in the category "Management".', ephemeral: true });
        }

        //get imageurl
        var iurl = "https://upload.wikimedia.org/wikipedia/commons/c/ca/1x1.png"
        db.all(`SELECT * FROM guilds WHERE guildid = ?`, [interaction.guild.id], async (err, rows) => {
            if (err) {
                console.error(err.message);
                return;
            }
            if (rows.length > 0) {
                if (rows[0].imageurl) {
                    iurl = rows[0].imageurl
                }
            }
        })

        if (imageurl) {
            console.log(`imageurl is ${imageurl}`)
            iurl = imageurl
        }


        const exampleEmbed = new EmbedBuilder()
            .setColor((color === null) ? 0x0099FF : color)
            .setTitle(title)
            .setAuthor({ name: 'Quantas Starlines', iconURL: 'https://i.ibb.co/Xxb3FC4/Quantas-Logo-V2-Discord.png' })
            .setDescription(description)
            .addFields(
                { name: 'When?', value: `<t:${timestamp - 3600}:F>, <t:${timestamp - 3600}:R>` },
                { name: 'Able to/interested to participate?', value: 'React below with the roles you could fulfil (🧑🏻‍✈️ for pilot, 🪠 for escort, 🔫 for onboard security, 🍾 for bartender and react with both your role and with ❔ emoji for maybe). Only react with roles that you are trained for (roles that you also have in the discord)!\n'+((_roles)? _roles:" ")},
            )
            .setTimestamp()
            .setFooter({ text: 'Posted by '+name, iconURL: interaction.user.avatarURL()})
            .setImage(iurl)

        
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
                const filter = i => i.user.id === interaction.user.id
                const confirmation = await response.awaitMessageComponent({ filter: filter, time: 60_000 });
                if (confirmation.customId === 'confirm') {
                    const message = await channel.send({ embeds: [exampleEmbed] });
                    await interaction.editReply({ content: 'Sending Message...', components: [], embeds: [], ephemeral: true });
                    await message.react('🧑‍✈️');
                    await message.react('🪠');
                    await message.react('🔫');
                    await message.react('🍾');
                    await message.react('❔');

                    let uuid = uuidv4()

                    console.log(`iurl is ${iurl}`)
                    db.run(`INSERT INTO events (uuid, guildid, title, description, timestamp, imageurl) VALUES (?, ?, ?, ?, ?, ?)`, [uuid, interaction.guild.id, title, description, timestamp, iurl], function (err, row) {
                        if (err) {
                            console.error(err.message);
                        } else {
                            handleMessage(interaction.client, db, message.id, message.channel, uuid, interaction.guild.id);
                            db.run(`INSERT INTO announcements (type, guildid, messageid, channelid, eventuuid) VALUES ("EMPLOYEE_JOBPOST",?, ?, ?, ?)`, [interaction.guild.id, message.id, message.channel.id, uuid], function (err, row) {
                                if (err) {
                                    console.error(err.message);
                                } 
                                console.log(typeof(interaction))
                                getSetting(db, interaction.guild.id, 'management_updates_channel').then((val) => {
                                    if (val) {
                                        const channel = interaction.guild.channels.cache.get(val.replace(/[<#>]/g, "")); // this regex removes the <# and > from the string
                                        if (channel) {
                                            buildEventManagerMessage(db, uuid).then((messageToSend) => {
                                                channel.send(messageToSend).then(message => {
                                                    db.run(`INSERT INTO announcements (type, guildid, messageid, channelid, eventuuid) VALUES ("INTERNAL_EVENTMANAGER",?, ?, ?, ?)`, [message.guild.id, message.id, message.channel.id, uuid], function (err, row) {
                                                        interaction.followUp({ content: 'Event has been posted successfully. Management message has been posted to '+val, components: [], embeds: [], ephemeral: true });
                                                        if (err) {
                                                            console.error(err.message);
                                                        }
                                                    });
                                                });;
                                            })
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

