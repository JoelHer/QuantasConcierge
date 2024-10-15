async function setSetting(db, guildid, key, value) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO settings (guildid, key, value) 
                VALUES (?, ?, ?)
                ON CONFLICT(guildid, key) DO UPDATE SET value=?`,
                [guildid, key, value, value], function (err) {
            if (err) {
                return reject(err);
            }
            resolve(this.changes);
        });
    });
}


async function getSetting(db, guildid, key) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT value FROM settings WHERE guildid = ? AND key = ?`, 
                [guildid, key], (err, row) => {
            if (err) {
                return reject(err);
            }
            resolve(row ? row.value : null);
        });
    });
}

async function updateSetting(db, interaction, key, newValue) {
    try {
        await setSetting(db, interaction.guild.id, key, newValue);
        await interaction.followUp(`Successfully updated ${key} to "${newValue}".`);
    } catch (error) {
        console.error('Error updating setting:', error);
        await interaction.followUp('There was an error updating the setting.');
    }
}

//export
module.exports = {
    setSetting,
    getSetting,
    updateSetting
};
