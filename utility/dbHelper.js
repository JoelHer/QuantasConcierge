function verifySettingsJson(obj) {
    return Object.values(obj).every(section => 
        Object.values(section).every(item => item.friendlyName && item.dataType)
    );
}


async function setSetting(db, id, key, value) {
    console.log(`Setting ${key} to ${value} for guild ${id}`);
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO settings (id, key, value) 
                VALUES (?, ?, ?)
                ON CONFLICT(id, key) DO UPDATE SET value=?`,
                [id, key, value, value], function (err) {
            if (err) {
                return reject(err);
            }
            resolve(this.changes);
        });
    });
}


async function getSetting(db, guildid, key) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM settings JOIN guilds ON guilds.id = settings.id WHERE guildid = ? AND key = ?`, 
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
        db.get('SELECT * FROM guilds WHERE guildid = ?', [interaction.guild.id], (err, row) => {
            if (err) {
                console.error(err.message);
            }
            if (!row) {
                db.run('INSERT INTO guilds(guildid) VALUES(?)', [interaction.guild.id], (err, _row) => {
                    if (err) {
                        console.error(err.message);
                    } else {
                        setSetting(db, row.id, key, newValue);
                        interaction.followUp(`Successfully updated ${key} to "${newValue}".`);
                    }
                });
            } else {
                setSetting(db, row.id, key, newValue);
                interaction.followUp(`Successfully updated ${key} to "${newValue}".`);
            }
        });
        
    } catch (error) {
        console.error('Error updating setting:', error);
        await interaction.followUp('There was an error updating the setting.');
    }
}

//export
module.exports = {
    setSetting,
    getSetting,
    updateSetting,
    verifySettingsJson
};
