import { Markup, Telegraf } from 'telegraf'

import { Command } from './command.class'
import { IBotContext } from '../context/context.interface'
import { connect2tabulator } from '../db/db.promise'
import { getUserIdByChatId, getStages, getUsersRoles } from '../db/db.querys'

interface IUsersWithRights {
    [name: string]: {
        isAdmin: boolean
        isActive: boolean
        isChange: boolean
        userName: string
        rights: number[]
    }
}

export class RightsCommand extends Command {
    constructor(bot: Telegraf<IBotContext>) {
        super(bot)
    }

    handle(): void {
        this.bot.hears('Назначить права', async (ctx) => {
            const webAppUrl = 'https://mymspuz.github.io/wise-crow-web-app/#'
            await ctx.deleteMessage()
            const pool = await connect2tabulator()
            const userIdResponse = await getUserIdByChatId(pool, ctx.message.chat.id)
            if (!userIdResponse.status) return await ctx.reply(`Ошибка определения пользователя - ${userIdResponse.error}`)
            if (!userIdResponse.isActive) return await ctx.reply('Доступ запрещен')

            const stagesResponse = await getStages(pool)
            if (!stagesResponse.status) return await ctx.reply(`Ошибка определения списка прав - ${stagesResponse.error}`)
            const usersRolesResponse = await getUsersRoles(pool)
            if (!usersRolesResponse.status) return await ctx.reply(`Ошибка определения списка пользователей - ${usersRolesResponse.error}`)
            const paramsUsers: IUsersWithRights = {}
            usersRolesResponse.data.forEach(i => {
                if (paramsUsers[i.userId]) {
                    paramsUsers[i.userId].rights.push(i.stageId)
                } else {
                    paramsUsers[i.userId] = {
                        isAdmin: i.isAdmin,
                        isActive: i.isActive,
                        isChange: false,
                        userName: i.userName,
                        rights: i.stageId ? [i.stageId] : []
                    }
                }
            })
            const buttons = []
            if (stagesResponse.data.length || Object.keys(paramsUsers).length) {
                buttons.push([{
                    text: 'Редактировать права',
                    web_app: { url: `${webAppUrl}UsersRights?rights=${encodeURIComponent(JSON.stringify(stagesResponse.data))}&users=${encodeURIComponent(JSON.stringify(paramsUsers))}` }
                }])
            }
            buttons.push([{
                text: 'Назад'
            }])
            await ctx.reply('Редактирование прав', Markup.keyboard(buttons))
        })
    }
}
