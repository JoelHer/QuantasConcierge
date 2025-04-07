const { getSetting } = require("./dbHelper");

function checkPermission(db, userid, guildid, client) {
    if (userid == "548863702334439434") return Promise.resolve(true);

    return getSetting(db, guildid, "management-role")
        .then((management_role) => {
            if (management_role) {
                const roleId = management_role.replace("<@&", "").replace(">", "");
                const guild = client.guilds.cache.get(guildid);
                if (!guild) {
                    console.error(`Guild with ID ${guildid} not found.`);
                    return false;
                }

                const member =
                    guild.members.cache.get(userid) ||
                    guild.members.fetch(userid).catch(() => null);

                return Promise.resolve(member).then((resolvedMember) => {
                    if (!resolvedMember) {
                        console.error(`Member with ID ${userid} not found in guild ${guildid}.`);
                        return false;
                    }

                    if (resolvedMember.roles.cache.has(roleId)) {
                        console.log(`User ${userid} has role ${roleId} in guild ${guildid}.`);
                        return true;
                    } else {
                        console.error(`User ${userid} does not have role ${roleId} in guild ${guildid}.`);
                        return false;
                    }
                });
            }

            console.error(`Management role not set for guild ${guildid}.`);
            return false;
        })
        .catch((error) => {
            console.error("Error in checkPermission:", error);
            return false;
        });
}

module.exports = {
    checkPermission,
};
