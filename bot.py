import discord
import datetime
from discord.utils import get
class event:
    pilots = []
    guards = []
    barstaff = []
    escort = []
    def __init__(self, newid, newdate, sentmessage):
        eventid = newid
        date = newdate
        message = sentmessage
    def addpilot(self, pilot):
        self.pilots.append(pilot)

    def addguards(self, guard):
        self.guards.append(guard)
    def addbarstaff(self, bartender):
        self.barstaff.append(bartender)
    def addescort(self, pilot):
        self.escort.append(pilot)
    def removeplayer(self, player):
        for x in self.pilots:
            if self.pilots[x] == player:
                self.pilots.remove(player)
        for x in self.guards:
            if self.guards[x] == player:
                self.guards.remove(player)
        for x in self.barstaff:
            if self.barstaff[x] == player:
                self.barstaff.remove(player)
        for x in self.escort:
            if self.escort[x] == player:
                self.escort.remove(player)

events = []


intents = discord.Intents.default()
intents.message_content = True
client = discord.Client(intents=intents)


@client.event
async def on_ready():
    print('We have logged in as {0.user}'.format(client))


@client.event
async def on_message(message):
    newmessage = ""
    if message.author == client.user:
        return

    if message.content.startswith('$create'):
        author = message.user
        # NOTE: change "admin" to "captain" for release
        if 'admin' in [x.name.lower() for x in message.author.roles]:
            args = message.split('--')
            for x in args:
                if x.lower().startswith("title="):
                    title = x.strip('"')
                    title.replace("title=", "")
                elif x.lower().startswith("desc="):
                    desc = x.strip('"')
                    desc.replace("desc=", "")
                elif x.lower().startswith("date="):
                    date = x.strip('date=":')
                    fdate = datetime.datetime()

            newmessage =


        else:
            await message.channel.send("You are not authorised to create events.")

client.run('MTAxMzYxMDU4MzYyNDUzNjE1NQ.GlYaAO.maSSyRQwEAyb4x_tkPJ8jqDlrJKO5UU1V08RGo')
