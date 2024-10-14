# QuantasConcierge
A discord bot to manage events.

### Configuration 
A json file called config.json is needed to for the bot to run and update/deploy the slash commands. Create the file with the following content:
```json
{
	"token": "your-token-goes-here",
	"clientId": "your-application-id-goes-here",
	"guildId": "your-server-id-goes-here"
}
```
**token**: Your discord's bot token 
**clientId**: Your application-ID that can be found on the dev portal
**guildId**: A server-ID the bot is on to deploy and update the commands. 