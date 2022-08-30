import discord
from discord.utils import get
players = []

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
        if 'admin' in [x.name.lower() for x in message.author.roles]:
            args = message.split('--')
        else:
            await message.channel.send("You are not authorised to create events.")
    elif message.content.startswith('$list'):

        if newmessage == "":
            newmessage = 'There have been no reservations'
        await message.channel.send(newmessage)
    elif message.content.startswith('$clearall'):
        if 'hosts' in [y.name.lower() for y in message.author.roles]:
            for i in range(len(players)):
                players[i] = ""
            await message.channel.send('Cleared all reservations')
        else:
            await message.channel.send("You are not a host and therefore can't clear all reservations")
    elif message.content.startswith('$clear'):
        author = message.author
        for i in range(len(players)):
            if players[i] == str(author):
                players[i] = ""
        await message.channel.send('You no longer reserve a nation')

client.run('MTAxMzYxMDU4MzYyNDUzNjE1NQ.GlYaAO.maSSyRQwEAyb4x_tkPJ8jqDlrJKO5UU1V08RGo')
