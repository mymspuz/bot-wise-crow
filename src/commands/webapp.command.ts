import { Markup, Telegraf } from 'telegraf'
import { message } from 'telegraf/filters'

import { Command } from './command.class'
import { IBotContext } from '../context/context.interface'
import { connect2tabulator } from '../db/db.promise'
import {
    getTask,
    takeTask,
    getUserIdByChatId,
    closeTask,
    refuseTask,
    nextTask,
    nextStep,
    addHistory,
    getRootTask,
    updateProject,
    resetProjectTask,
    rebootProject,
    changeAdminActive,
    clearUserStages,
    addUserStage,
    getPackageTask,
    getSubscribersRemote,
} from '../db/db.querys'

interface IMyTask {
    id: number
    assortName: string
    stageName: string
    needTo: number
    made: number
    defect: number
    price: number
    refuse: boolean
}

interface IUsersWithRights {
    [name: string]: {
        isAdmin: boolean,
        isActive: boolean,
        isChange: boolean
        userName: string,
        rights: number[]
    }
}

export class WebAppCommand extends Command {
    constructor(bot: Telegraf<IBotContext>) {
        super(bot)
    }

    handle(): void {
        this.bot.on(message('web_app_data'), async (ctx) => {
            const webAppData = ctx.message.web_app_data
            const pool = await connect2tabulator()

            const startNextTask = async (taskId: number, made: number) => {
                // Ищем следующий шаг задачи
                const nextResponse = await nextTask(pool, taskId)
                if (nextResponse.status) {
                    if (nextResponse.data) {
                        const nextStepResponse = await nextStep(pool, nextResponse.data, made)
                        // Если задача является удаленной - нужно оповестить людей, которые подписаны на подобные задачи.
                        if (nextStepResponse.status) {
                            const nextTaskResponse = await getTask(pool, String(nextStepResponse.id))
                            if (nextTaskResponse.status) {
                                const nextTask = nextTaskResponse.data[0]
                                if (nextTask.remote === 1) {
                                    const subscribersResponse = await getSubscribersRemote(pool, nextTask.stageId)
                                    if (subscribersResponse.status) {
                                        const msgText = `Появилась новая удаленная задача - ${nextTask.assortName} (${nextTask.stageName}) в количестве ${nextTask.needTo}, цена ${nextTask.price}`
                                        for (const subscriber of subscribersResponse.subscribers) {
                                            try {
                                                await ctx.telegram.sendMessage(subscriber.telegramId, msgText)
                                                console.log(`Send subscriber - ${subscriber.userName} msg [${msgText}]`)
                                            } catch (e: any) {
                                                console.log(`Error send subscriber - ${e.message}`)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        const rootTaskResponse = await getRootTask(pool, taskId)
                        if (rootTaskResponse.status) {
                            const rootTask = rootTaskResponse.data
                            const balance = made + rootTask.curBalance
                            // Переносим все сделанное на баланс артикула
                            const updateProjectResponse = await updateProject(pool, rootTask.assortId, balance)
                            if (!updateProjectResponse.status) console.log(`Update project error - ${updateProjectResponse.error}`)
                            // Обнуляем все этапы выполнения проекта
                            const resetProjectTaskResponse = await resetProjectTask(pool, rootTask.assortId)
                            if (!resetProjectTaskResponse.status) console.log(`Reset project tasks error - ${resetProjectTaskResponse.error}`)
                            // Если получившийся остаток меньше требуемого минимума - запускаем проект с первого шага
                            if (rootTask.minBalance > balance) {
                                const rebootProjectResponse = await rebootProject(pool, rootTask.assortId, rootTask.stageId, rootTask.minBalance - balance)
                                if (!rebootProjectResponse.status) console.log(`Reboot project error - ${rebootProjectResponse.error}`)
                            }
                        } else {
                            console.log(`Get root task error - ${rootTaskResponse.error}`)
                        }
                    }
                } else {
                    console.log(`Next task error - ${nextResponse.error}`)
                }
            }

            const packageTask = async (made: number) => {
                // Выясним задачу, которая отвечает за изготовление упаковки
                const taskPackageResponse = await getPackageTask(pool)
                if (taskPackageResponse.status) {
                    // В любом случае уменьшим количество упаковки на складе
                    const balance = (taskPackageResponse.data.curBalance - made) < 0 ? 0 : taskPackageResponse.data.curBalance - made
                    const updateProjectResponse = await updateProject(pool, taskPackageResponse.data.assortId, balance)
                    if (!updateProjectResponse.status) console.log(`Update project package error - ${updateProjectResponse.error}`)
                    // Если остаток меньше допустимого и в данный момент задачу ни кто не выполняет - перезапустим проект
                    if (taskPackageResponse.data.minBalance > balance) {
                        const rebootProjectResponse = await rebootProject(pool, taskPackageResponse.data.assortId, taskPackageResponse.data.stageId, taskPackageResponse.data.minBalance - balance)
                        if (!rebootProjectResponse.status) console.log(`Reboot project package error - ${rebootProjectResponse.error}`)
                    }

                } else {
                    console.log(`Task package error - ${taskPackageResponse.error}`)
                }
            }

            if (webAppData.button_text === 'Список задач') {
                const result: string[] = []
                const userIdResponse = await getUserIdByChatId(pool, ctx.message.chat.id)
                const tasksResponse: { tasks: string[] } = JSON.parse(webAppData.data)
                //if (tasksResponse.task !== '0') tasksResponse.tasksRemote.push(tasksResponse.task)
                for (const taskId of tasksResponse.tasks) {
                    const statusTask = await getTask(pool, taskId)
                    if (statusTask.status && statusTask.data.length) {
                        const task = statusTask.data[0]
                        if (task.status) {
                            result.push(`🔴 Задача ${task.assortName} [${task.stageName}] - уже занята!!!`)
                        } else {
                            const takeTaskResponse = await takeTask(pool, Number(taskId), userIdResponse.id)
                            if (takeTaskResponse.status) {
                                result.push(`🟢 Задача ${task.assortName} [${task.stageName}] ${task.needTo} шт. - успешно назначена`)
                            } else {
                                result.push(`🔴 Задача ${task.assortName} [${task.stageName}] - ошибка назначения!!!`)
                            }
                        }
                    } else {
                        result.push(`🔴 Задача ${taskId} - ошибка назначения!!!`)
                    }
                }
                const resultMsg = result.join('\n')
                console.log(`[Список задач] userId ${userIdResponse.id}: ${resultMsg}`)
                await ctx.reply(`Результат обработки запроса:\n${resultMsg}`, Markup.keyboard([[{ text: 'Назад' }]]))
            }

            if (webAppData.button_text === 'Мои задачи') {
                const result: string[] = []
                const userIdResponse = await getUserIdByChatId(pool, ctx.message.chat.id)
                const tasksResponse: { tasks: IMyTask[] } = JSON.parse(webAppData.data)
                for (const task of tasksResponse.tasks) {
                    if (!task.id) continue
                    if (task.refuse) {
                        const refuseResponse = await refuseTask(pool, task.id)
                        if (refuseResponse.status) {
                            result.push(`🟢 Задача ${task.assortName} [${task.stageName}] - успешно отменена`)
                        } else {
                            result.push(`🔴 Задача ${task.assortName} [${task.stageName}] - ошибка ${refuseResponse.error}`)
                        }
                        continue
                    }
                    if (task.made > 0 || task.defect > 0) {
                        if ((task.made + task.defect) >= task.needTo) {
                            const closeResponse = await closeTask(pool, task.id, task.made, task.defect)
                            if (closeResponse.status) {
                                result.push(`🟢 Задача ${task.assortName} [${task.stageName}] - успешно закрыта на сумму ${task.made * task.price}`)
                                const historyResponse = await addHistory(pool, userIdResponse.id, task.assortName, task.stageName, task.made, task.price, task.price * task.made)
                                if (!historyResponse.status) console.log(`Add to history error - ${historyResponse.error}`)
                                // Старт следующего шага проекта
                                await startNextTask(task.id, task.made)
                                // Учитываем упаковку
                                if (task.stageName.toLowerCase().includes('упаковать')) {
                                    await packageTask(task.made)
                                }
                            } else {
                                result.push(`🔴 Задача ${task.assortName} [${task.stageName}] - ошибка закрытия ${closeResponse.error}`)
                            }
                        } else {
                            result.push(`🔴 Задача ${task.assortName} [${task.stageName}] - указано некорректное количество`)
                        }
                    }
                }
                const resultMsg = result.join('\n')
                console.log(`[Список задач] userId ${userIdResponse.id}: ${resultMsg}`)
                await ctx.reply(`Результат обработки запроса:\n${resultMsg}`, Markup.keyboard([[{ text: 'Назад' }]]))
            }

            if (webAppData.button_text === 'Редактировать права') {
                const usersResponse: { users: IUsersWithRights } = JSON.parse(webAppData.data)
                const result = []
                for (const userId in usersResponse.users) {
                    const user = usersResponse.users[userId]
                    if (!user.isChange) continue
                    result.push(user.userName)
                    // Установим админа и активность
                    const isResponse = await changeAdminActive(pool, Number(userId), user.isAdmin, user.isActive)
                    if (!isResponse.status) console.log(`For userId ${userId} error change active - ${isResponse.error}`)
                    const clearResponse = await clearUserStages(pool, Number(userId))
                    if (!clearResponse.status) console.log(`For userId ${userId} error clear roles - ${clearResponse.error}`)
                    for (const stageId of user.rights) {
                        const addResponse = await addUserStage(pool, Number(userId), stageId)
                        if (!addResponse.status) console.log(`For userId ${userId} error add roles - ${addResponse.error}`)
                    }
                }
                if (result.length) await ctx.reply(`Права были изменены для следующих пользователей:\n${result.join('\n')}`)
            }
        })
    }
}


