import discord
from discord.utils import get
players = []

client = discord.Client()


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
        args = message.split('--')
        if author
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

client.run('NzQ2Mzg2Njc4OTIyNjA4NzAw.Xz_kww.8QQVmvG3is4Q7fmLxnjdkRhH5Ug')
