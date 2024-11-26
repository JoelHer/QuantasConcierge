const { EmbedBuilder } = require('discord.js');

const startsWithVowel = str => /^[aeiou]/i.test(str);

module.exports = {
    async renderPublish(db, interaction, event, location) {
        const getRolePrices = function(db, eventId) {
            const sql = `
                SELECT tr.rolename, COALESCE(egr.seats, 0) AS seats, COALESCE(egr.price, 0) AS price
                FROM ticketroles tr LEFT JOIN eventguestrole egr ON tr.ticketroleid = egr.roleid AND egr.eventid = ?
            `;
        
            return new Promise((resolve, reject) => {
                db.all(sql, [eventId], (err, rows) => {
                    if (err) {
                        reject(err); // Reject the promise on error
                    } else {
                        resolve(rows); // Resolve the promise with the result
                    }
                });
            });
        }
    
        let rolePrices = await getRolePrices(db, event.uuid);
    
        let pricingString = "";
    
        rolePrices = rolePrices.filter(role => role.price >= 0);
        rolePrices = rolePrices.filter(role => role.seats > 0);
    
        if (rolePrices.length == 0) 
            pricingString = "Entry to this event is free for all participants.";
        if (rolePrices.length == 1)
            pricingString = `A ticket for this tour ${(rolePrices[0].price == 0)? "is free.":"costs "+role.price+" (" +role.price/1000+"K) aUEC"}\n`;
        if (rolePrices.length > 1) {
            rolePrices.forEach(role =>{
                pricingString += `A${(startsWithVowel(role.rolename)? "n ":" ")+role.rolename} ticket for this tour ${(role.price == 0)? "is free.":"costs "+role.price+" (" +role.price/1000+"K) aUEC"}\n`;
            })
        }
    
        let limitedSeats = ""
        if (rolePrices.length == 0)
            limitedSeats = `Signup is limited to 25 passengers.`;
        if (rolePrices.length == 1)
            limitedSeats = `Signup is limited to ${rolePrices[0].seats} passengers.`;
        if (rolePrices.length > 1) {
            limitedSeats = `Signup is limited to `;
            rolePrices.forEach(role =>{
                if (role == rolePrices[rolePrices.length-1]) {
                    limitedSeats = limitedSeats.slice(0, -2) + " and ";
                } else {
                    
                }
                limitedSeats += `${role.seats} ${role.rolename} passenger${(role.seats == 1)?"":"s"}, `;
                //if its the last eleement add a dot
                if (role == rolePrices[rolePrices.length-1])
                    limitedSeats = limitedSeats.slice(0, -2) + "."
    
            })
        }
        
        limitedSeats += ` Signup closes in <t:${event.timestamp-3600}:R>.`;
    
        const embed = new EmbedBuilder()
            .setTitle(event.title)
            .setColor(0x062d79)
            .setAuthor({ name: 'Quantas Starlines', iconURL: 'https://i.ibb.co/Xxb3FC4/Quantas-Logo-V2-Discord.png' })
            .setDescription(event.description)
            .addFields(
                { 
                    name: 'Boarding and requirements', 
                    value: `Boarding commences at **${location}** on <t:${event.timestamp}:F>.`
                }, 
                {
                    name: "Tickets",
                    value: pricingString
                },
                {
                    name: "How to pay",
                    value: "Once you've signed up using the post, open the payment thread below."
                },
                {
                    name: "   ",
                    value: limitedSeats
                }
            )
            .setImage(event.imageurl)
            .setFooter({ text: 'Credits to BuildandPlay on Discord for the screenshot.' });
    
        
    
        return { embeds: [embed], components: [], ephemeral: true, fetchReply: true };
    }
}