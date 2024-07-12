const SUBSCRIBE = {
    name: 'subscribe',
    description: '訂閱公告到此頻道',
}

const UNSUBSCRIBE = {
    name: 'unsubscribe',
    description: '取消訂閱公告到此頻道',
}

const command = {
    SUBSCRIBE,
    UNSUBSCRIBE,
}

export default command

// import { REST } from '@discordjs/rest'
// import { Routes } from 'discord-api-types/v10'

// const token = ''
// const applicationId = ''
// const rest = new REST().setToken(token)

// async function registerCommands() {
//     await rest.put(Routes.applicationCommands(applicationId), { body: [SUBSCRIBE, UNSUBSCRIBE] })
// }

// registerCommands()
