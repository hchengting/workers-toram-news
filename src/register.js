import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v10'
import command from './command.js'

const token = ''
const applicationId = ''
const rest = new REST().setToken(token)

async function registerCommands() {
    await rest.put(Routes.applicationCommands(applicationId), { body: Object.values(command) })
}

registerCommands()
