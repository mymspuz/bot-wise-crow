import { Markup, Telegraf } from 'telegraf'

import { Command } from './command.class'
import { IBotContext } from '../context/context.interface'
import { connect2tabulator } from '../db/db.promise'
import { getTasks, getUserIdByChatId, getMyTasks, getUserRoles } from '../db/db.querys'

export class TasksCommand extends Command {
    constructor(bot: Telegraf<IBotContext>) {
        super(bot)
    }

    handle(): void {
        this.bot.hears('Меню задач', async (ctx) => {
            const webAppUrl = 'https://mymspuz.github.io/wise-crow-web-app/#'
            await ctx.deleteMessage()
            const pool = await connect2tabulator()
            const userIdResponse = await getUserIdByChatId(pool, ctx.message.chat.id)
            if (!userIdResponse.status) return await ctx.reply(`Ошибка определения пользователя - ${userIdResponse.error}`)
            if (!userIdResponse.isActive) return await ctx.reply('Доступ запрещен')
            // Если пользователь не является админом - запросим права для него
            const userRights: number[] = []
            if (!userIdResponse.isAdmin) {
                const userRightsResponse = await getUserRoles(pool, userIdResponse.id)
                if (!userRightsResponse.status) return await ctx.reply(`Ошибка определения прав пользователя - ${userRightsResponse.error}`)
                userRightsResponse.data.forEach(r => userRights.push(r))
            }
            // Определим существующий список задач для пользователя
            const myTasks = await getMyTasks(pool, userIdResponse.id)
            const localMyTasks: {[key: number]: number} = {}
            if (!myTasks.status) return await ctx.reply(`Ошибка определения списка моих задач - ${myTasks.error}`)
            const paramsMyTasks: number[] = []
            myTasks.data.forEach(m => {
                paramsMyTasks.push(m.id)
                localMyTasks[m.id] = m.needTo
            })
            // Если у пользователя есть хотя бы одна не "удаленная" задача - больше ему не выдавать
            const isAlreadyTask = false // paramsMyTasks.some(task => !task.remote)

            // Составим список доступных пользователю задач
            const tasks = await getTasks(pool)
            if (!tasks.status) return await ctx.reply(`Ошибка определения списка задач - ${tasks.error}`)
            const paramsTasks: string[] = []
            const paramsRemoteTasks: string[] = []
            let isPriority = false
            const localTasks: {[key: number]: number} = {}
            tasks.data.forEach(task => {
                // Проверка прав на задачу
                if (userIdResponse.isAdmin || userRights.includes(task.stageId)) {
                    const temp = `${task.id}|${task.assortName} [${task.stageName}] ${task.needTo} шт. ${task.price} руб.`
                    if (task.remote === 1) {
                        paramsRemoteTasks.push(temp)
                        localTasks[task.id] = task.needTo
                    } else {
                        if (!isAlreadyTask && !isPriority) {
                            paramsTasks.push(temp)
                            localTasks[task.id] = task.needTo
                        }
                    }
                    // Если нашли приоритетную задачу - ставим признак
                    if (task.priority === 1) isPriority = true
                }
            })

            // Определим клавиатуру, которую покажем пользователю
            const buttons = []
            let txt: string = 'Меню задач'
            if (paramsTasks.length || paramsRemoteTasks.length) {
                buttons.push([{
                    text: 'Список задач',
                    web_app: { url: `${webAppUrl}TaskSelection?userId=${ctx.message.chat.id}&tasks=${encodeURIComponent(JSON.stringify(localTasks))}` }
                }])
            }
            // console.log(buttons[0][0].web_app.url)
            if (paramsMyTasks.length) {
                buttons.push([{
                    text: 'Мои задачи',
                    web_app: { url: `${webAppUrl}TaskCompletion?userId=${ctx.message.chat.id}&tasks=${encodeURIComponent(JSON.stringify(localMyTasks))}` }
                }])
            }
            // console.log(buttons[1][0].web_app.url)

            if (!buttons.length) {
                txt = 'Меню'
                buttons.push([{
                    text: 'Меню задач'
                }])
            } else {
                buttons.push([{
                    text: 'Назад'
                }])
            }
            if (!paramsTasks.length && !paramsRemoteTasks.length && !paramsMyTasks.length) txt = 'У вас нет ваших и доступных вам задач.'
            await ctx.reply(txt, Markup.keyboard(buttons))
        })
    }
}