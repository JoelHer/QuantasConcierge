function verifySettingsJson(obj) {
    return Object.values(obj).every(section => 
        Object.values(section.settings).every(item => item.friendlyName && item.dataType)
    );
}


async function setSetting(db, id, key, value) {
    console.log('Setting ', key, ' to ', value);
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

async function getIdByGuildId(db, guildid) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM guilds WHERE guildid = ?`, [guildid], (err, row) => {
            if (err) {
                return reject(err);
            }
            resolve(row ? row.id : null);
        });
    });
}

async function updateSetting(db, interaction, key, newValue, ephemeral = false) {
    try {
        db.get('SELECT * FROM guilds WHERE guildid = ?', [interaction.guild.id], (err, row) => {
            if (err) {
                console.error(err.message);
            }
            if (!row) {
                db.run('INSERT INTO guilds(guildid) VALUES(?)', [interaction.guild.id], (err, _row) => {
                    // TODO: Insert default settings
                    if (err) {
                        console.error(err.message);
                    } else {
                        setSetting(db, row.id, key, newValue);
                        interaction.followUp({ content: `Successfully updated ${key} to "${newValue}".`, ephemeral: ephemeral });
                    }
                });
            } else {
                console.log(row.id, key, newValue);
                setSetting(db, row.id, key, newValue);
                interaction.followUp({ content: `Successfully updated ${key} to "${newValue}".`, ephemeral: ephemeral });
            }
        });
        
    } catch (error) {
        console.error('Error updating setting:', error);
        await interaction.followUp({ content: 'There was an error updating the setting.', ephemeral: ephemeral });
    }
}

//export
module.exports = {
    setSetting,
    getSetting,
    getIdByGuildId,
    updateSetting,
    verifySettingsJson
};
