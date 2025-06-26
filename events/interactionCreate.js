const { Events, EmbedBuilder } = require('discord.js');

const { getSetting } = require('../utility/dbHelper');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction, db) {
		// 💬 Handle Chat Input Commands
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({
						content: 'There was an error while executing this command!',
						ephemeral: true,
					});
				} else {
					await interaction.reply({
						content: 'There was an error while executing this command!',
						ephemeral: true,
					});
				}
			}
			return; // Important: avoid fallthrough
		}

		// 📋 Handle Modal Submissions
		if (interaction.isModalSubmit()) {
			if (interaction.customId.startsWith('taxiFeedbackModal.')) {
				const taxiUUID = interaction.customId.split('.')[1]; // Extract UUID
				const feedback = interaction.fields.getTextInputValue('feedbackInput');

				let management_updates_channel = await getSetting(db, interaction.guild.id, 'management_updates_channel');
				//remove the <#channel> formatting
				management_updates_channel = management_updates_channel.replace(/<#(\d+)>/, '$1');

				let didaFuckingErrorHappen = false;

				try {
					const managementChannel = await interaction.client.channels.fetch(management_updates_channel);
					if (managementChannel) {
						const fetched_taxirequest = await new Promise((resolve, reject) => {
							db.get(
								`SELECT * FROM taxi_requests WHERE request_id = ?`,
								[taxiUUID],
								(err, row) => {
									if (err) reject(err);
									else resolve(row);
								}
							);
						});

						const feedbackEmbed = new EmbedBuilder()
							.setTitle('Taxi Feedback Received')
							.setDescription(`New feedback has been submitted by <@${fetched_taxirequest.user_id}>, Employees: ${fetched_taxirequest.accepted_people.replace(";", ", ")}`)
							.setColor(0x00BFFF) 
							.addFields(
								{ name: 'Feedback', value: feedback },
								{ name: 'Request ID', value: taxiUUID },
							)
							.setTimestamp();

						await managementChannel.send({embeds: [feedbackEmbed] });
					} else {
						console.error(`Management channel not found: ${management_updates_channel}`);
					}
				} catch (error) {
					console.error(`Error fetching management channel: ${error}`);
					didaFuckingErrorHappen = true;
				}

				if (didaFuckingErrorHappen) {
					await interaction.reply({
						content: 'There was an error sending your feedback to the management channel. Please reach out to us directly for any feedback.',
						ephemeral: true,
					});
					return;
				}

				console.log(`Received taxi feedback for ${taxiUUID}: ${feedback}`);

				const feedbackEmbed = new EmbedBuilder()
					.setTitle('Thank you for your feedback!')
					.setDescription('🚖 We’ve received your feedback on the taxi service.')
					.setColor(0x00BFFF) 
					.addFields(
						{ name: 'Request ID', value: taxiUUID },
						{ name: 'Your Feedback', value: feedback }
					)
					.setTimestamp();

				await interaction.reply({
					embeds: [feedbackEmbed],
					ephemeral: true,
				});
			}
		}
	},
};
