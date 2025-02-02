import { Telegraf } from 'telegraf'
import LocalSession from 'telegraf-session-local'
import express from 'express'
import cors, { CorsOptions } from 'cors'

import taskRoutes from './routes/tasks.router'

import { ConfigService } from './config/config.service'

import { IConfigInterface } from './config/config.interface'
import { IBotContext } from './context/context.interface'

import { Command } from './commands/command.class'
import { StartCommand } from './commands/start.command'
import { FilesCommand } from './commands/files.command'
import { TasksCommand } from './commands/tasks.command'
import { WebAppCommand } from './commands/webapp.command'
import { BackCommand } from './commands/back.command'
import { RightsCommand } from './commands/rights.command'
import { FileTasksCommand } from './commands/fileTasks.command'
import {BalanceCommand} from "./commands/balance.command";
import {FileBalanceCommand} from "./commands/fileBalance.command";

class Bot {
    bot: Telegraf<IBotContext>
    commands: Command[] = []

    constructor(private readonly configService: IConfigInterface) {
        this.bot = new Telegraf<IBotContext>(this.configService.get('TOKEN'))
        this.bot.use(new LocalSession({ database: 'sessions.json' })).middleware()
    }

    init() {
        this.commands = [
            new StartCommand(this.bot),
            new FilesCommand(this.bot),
            new TasksCommand(this.bot),
            new WebAppCommand(this.bot),
            new BackCommand(this.bot),
            new RightsCommand(this.bot),
            new FileTasksCommand(this.bot),
            new BalanceCommand(this.bot),
            new FileBalanceCommand(this.bot),
        ]
        for (const command of this.commands) {
            command.handle()
        }
        console.log('Bot start...')
        this.bot.launch().then(r => console.log('Bot stopped.'))
    }

    stop(reason: string) {
        this.bot.stop(reason)
    }
}

const bot = new Bot(new ConfigService())
bot.init()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

const app = express()
const port = process.env.PORT || 3001

const corsOptions: CorsOptions = {
    origin: 'https://localhost:3000'
    // origin: 'https://mymspuz.github.io/wise-crow-web-app'
}

app.use(cors(corsOptions))
app.use(express.json())
app.use('/tasks', taskRoutes)

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
})

