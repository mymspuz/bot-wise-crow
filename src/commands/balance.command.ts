import { Telegraf } from 'telegraf'

import { IBotContext } from '../context/context.interface'
import { Command } from './command.class'
import { connect2tabulator } from '../db/db.promise'
import { getUserIdByChatId, getBalanceSumUser } from '../db/db.querys'

export class BalanceCommand extends Command {
    constructor(bot: Telegraf<IBotContext>) {
        super(bot)
    }

    handle(): void {
        this.bot.hears('Ваш баланс', async (ctx) => {
            const pool = await connect2tabulator()
            const userIdResponse = await getUserIdByChatId(pool, ctx.message.chat.id)
            if (!userIdResponse.status) return await ctx.reply(`Ошибка определения пользователя - ${userIdResponse.error}`)
            if (!userIdResponse.isActive) return await ctx.reply('Доступ запрещен')

            const balanceResponse = await getBalanceSumUser(pool, userIdResponse.id)
            if (!balanceResponse.status) return await ctx.reply(`Ошибка определения баланса - ${balanceResponse.error}`)

            return await ctx.reply(`Вам должны - ${balanceResponse.balance} руб.`)
        })
    }
}