import { Telegraf } from 'telegraf'
import xlsx from 'node-xlsx'

import { Command } from './command.class'
import { IBotContext } from '../context/context.interface'
import { connect2tabulator } from '../db/db.promise'
import { getUserIdByChatId, getBalanceUsers } from '../db/db.querys'

export class FileBalanceCommand extends Command {
    constructor(bot: Telegraf<IBotContext>) {
        super(bot)
    }

    handle(): void {
        this.bot.hears('Скачать файл оплат', async (ctx) => {
            console.log('start pay file')
            const pool = await connect2tabulator()
            // Проверка пользователя
            const userIdResponse = await getUserIdByChatId(pool, ctx.message.chat.id)
            if (!userIdResponse.status) return await ctx.reply(`Ошибка определения пользователя - ${userIdResponse.error}`)
            if (!userIdResponse.isActive || !userIdResponse.isAdmin) return await ctx.reply('Доступ запрещен')

            const balanceUsersResponse = await getBalanceUsers(pool)
            if (!balanceUsersResponse.status) return await ctx.reply(`Ошибка определения баланса пользователей - ${balanceUsersResponse.error}`)

            const xlsxData: any[] = [['Пользователь', 'Баланс', 'Выплата']]
            balanceUsersResponse.data.forEach(i => {
                xlsxData.push([i.userName, i.balance, ''])
            })

            // @ts-ignore
            const buffer = xlsx.build([{name: 'balance', data: xlsxData}], {})
            await ctx.replyWithDocument({source: buffer, filename: 'balance.xlsx'})
        })
    }
}