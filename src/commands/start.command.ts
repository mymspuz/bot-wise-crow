import { Command } from './command.class'
import { Markup, Telegraf } from 'telegraf'

import { IBotContext } from '../context/context.interface'
import { connect2tabulator } from '../db/db.promise'
import { getUserIdByChatId } from '../db/db.querys'

export class StartCommand extends Command {
    constructor(bot: Telegraf<IBotContext>) {
        super(bot)
    }

    handle(): void {
        this.bot.start(async (ctx) => {
            const pool = await connect2tabulator()
            const isAdminResponse = await getUserIdByChatId(pool, ctx.message.chat.id)
            if (!isAdminResponse.status) return await ctx.reply(isAdminResponse.error)
            if (!isAdminResponse.isActive) return await ctx.reply('Доступ запрещен')

            const buttons = []
            if (isAdminResponse.isAdmin) {
                buttons.push([{ text: 'Скачать файл заданий' }, { text: 'Скачать файл оплат' }])
                buttons.push([{ text: 'Назначить права' }, { text: 'Меню задач' }])
            } else {
                buttons.push([{ text: 'Меню задач' }])
                buttons.push([{ text: 'Ваш баланс' }])
            }
            await ctx.reply('Меню', Markup.keyboard(buttons))
        })
    }
}