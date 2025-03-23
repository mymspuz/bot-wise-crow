import { Telegraf } from 'telegraf'
import xlsx from 'node-xlsx'
import * as fs from 'node:fs'
import * as https from 'node:https'

import { IBotContext } from '../context/context.interface'
import { Command } from './command.class'
import { connect2tabulator } from '../db/db.promise'
import {
    updateAssortment,
    updateStages,
    updateTask,
    updateSequenceStages,
    getRemainder,
    setRemainder,
    getUserIdByName,
    getTaskExists,
    addUserPay
} from '../db/db.querys'
import { IDBAssortment, IDBTask, IDBSequenceStage } from '../interfaces'

interface ISettingTask {
    code: string
    name: string
    position: number | undefined
    value: number | undefined
}

interface IProject {
    article: string
    name: string
    minRemainder: number
    currentRemainder: number
    needTo: number
    priority: number
    tasks: {
        name: string
        setting: ISettingTask[]
    }[]
}

interface ISold {
    article: string
    sold: number
}

const settingsProjects: ISettingTask[] = [
    { code: 'article', name: 'Артикул', position: undefined, value: undefined },
    { code: 'name', name: 'Наименование', position: undefined, value: undefined },
    { code: 'minRemainder', name: 'Минимальный остаток', position: undefined, value: undefined },
    { code: 'currentRemainder', name: 'Текущий остаток', position: undefined, value: undefined },
    { code: 'needTo', name: 'Необходимо', position: undefined, value: undefined },
    { code: 'priority', name: 'Приоритет', position: undefined, value: undefined },
]

const settingsTasks: ISettingTask[] = [
    { code: 'made', name: 'сделано', position: undefined, value: undefined },
    { code: 'defect', name: 'брак', position: undefined, value: undefined },
    { code: 'remote', name: 'удаленная', position: undefined, value: undefined },
    { code: 'responsible', name: 'ответственный', position: undefined, value: undefined },
    { code: 'price', name: 'цена', position: undefined, value: undefined }
]

export class FilesCommand extends Command {
    constructor(bot: Telegraf<IBotContext>) {
        super(bot)
    }

    handle() {
        this.bot.on('document', async (ctx) => {
            const isEmptyCell = (cellValue: string | number): boolean => {
                return !cellValue || cellValue === 'no' || (typeof cellValue === 'string' && cellValue.trim() === '')
            }
            const { file_id: fileId, mime_type: mimeType } = ctx.update.message.document
            if (mimeType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                await ctx.reply(`Неверный тип файла [${mimeType}]`)
            } else {
                const fileUrl = await ctx.telegram.getFileLink(fileId)
                https.get(fileUrl, response => {
                    const file = fs.createWriteStream('./incoming_file.xlsx')
                    response.pipe(file)
                    file.on('finish', async () => {
                        const resultMsg: string[] = []
                        file.close()
                        const workSheetsFromFile = xlsx.parse('./incoming_file.xlsx', {blankrows: true, defval: 'no'})
                        const projects: IProject[] = []
                        const sold: ISold[] = []
                        const balance: { userName: string, payout: number }[] = []
                        const tasks: { name: string, setting: ISettingTask[], order: number }[] = []
                        // const tempSettingsTasks: string[] = []
                        // const items: { article: string, tasks: { name: string, setting: ISettingTask[] }[] }[] = []
                        let countSetting = settingsTasks.length
                        let indexTasks = 0
                        let typeFile: string = 'tasks'
                        workSheetsFromFile.forEach(sheet => {
                            if (sheet.data[0][0].toLowerCase().trim() === 'артикул') typeFile = 'sold'
                            if (sheet.data[0][0].toLowerCase().trim() === 'пользователь') typeFile = 'balance'
                            if (sheet.data[1][0].toLowerCase().trim() === 'артикул') typeFile = 'tasks'

                            if (typeFile === 'tasks') {
                                sheet.data.forEach((row, indexRow) => {
                                    if (indexRow > 1) projects.push({
                                        article: '',
                                        name: '',
                                        currentRemainder: 0,
                                        minRemainder: 0,
                                        needTo: 0,
                                        priority: 0,
                                        tasks: []
                                    })
                                    row.forEach((cell, indexCell) => {
                                        // Собираем список заданий
                                        if (indexRow === 0 && !isEmptyCell(cell)) console.log('task cell - ', `[${cell}] : ${tasks.length}`)
                                        if (indexRow === 0 && !isEmptyCell(cell)) tasks.push({
                                            name: cell,
                                            setting: JSON.parse(JSON.stringify(settingsTasks)),
                                            order: tasks.length + 1
                                        })
                                        // Собираем настройки для каждой из задач
                                        if (indexRow === 1) {
                                            // Проверяем наименование столбца - если оно относится к настройкам проекта
                                            if (settingsProjects.filter(s => s.name === cell).length) {
                                                settingsProjects.forEach(s => {
                                                    if (s.name === cell) s.position = indexCell
                                                })
                                            } else {
                                                tasks[indexTasks].setting.forEach(setting => {
                                                    if (setting.name === cell) setting.position = indexCell
                                                })
                                                countSetting--
                                                if (!countSetting) {
                                                    countSetting = settingsTasks.length
                                                    indexTasks++
                                                }
                                            }
                                            //}
                                        }
                                        // Для каждого изделия собираем задания и заполняем его настройки
                                        if (indexRow > 1) {
                                            if (!isEmptyCell(cell)) {
                                                // Если номер ячейки находится среди номеров настроек проекта
                                                const property = settingsProjects.filter(sp => sp.position === indexCell)
                                                if (property.length) {
                                                    const projectProperty: string = property[0].code
                                                    // @ts-ignore
                                                    projects[indexRow - 2][projectProperty] = cell
                                                } else {
                                                    const task = tasks.filter(t => t.setting.some(s => s.position === indexCell))
                                                    if (task.length) {
                                                        if (!projects[indexRow - 2].tasks.some(t => t.name === task[0].name)) {
                                                            projects[indexRow - 2].tasks.push(JSON.parse(JSON.stringify(task[0])))
                                                        }
                                                        projects[indexRow - 2].tasks.forEach(t => {
                                                            t.setting.forEach(s => {
                                                                if (s.position === indexCell) s.value = cell
                                                            })
                                                        })
                                                    } else {
                                                        console.log(cell, indexCell, 'not found')
                                                    }
                                                }
                                            }
                                        }
                                    })
                                })
                            }

                            if (typeFile === 'sold') {
                                sheet.data.forEach((row, indexRow) => {
                                    if (indexRow > 0) {
                                        if (row[0]) {
                                            if (/^\d+$/.test(row[2])) {
                                                sold.push({ article: row[0], sold: Number(row[2]) })
                                            } else {
                                                if (!isEmptyCell(row[2])) resultMsg.push(`Ошибка в количестве для артикула ${row[0]}`)
                                            }
                                        }
                                    }
                                })
                            }

                            if (typeFile === 'balance') {
                                sheet.data.forEach((row, indexRow) => {
                                    if (indexRow > 0) {
                                        if (row[0] && row[2]) {
                                            if (/^\d+$/.test(row[2])) {
                                                balance.push({ userName: row[0], payout: Number(row[2]) })
                                            } else {
                                                if (!isEmptyCell(row[2])) resultMsg.push(`Ошибка в сумме для пользователя ${row[0]}`)
                                            }
                                        }
                                    }
                                })
                            }
                        })
                        const pool = await connect2tabulator()

                        // Обрабатываем продажи
                        if (typeFile === 'sold') {
                            if (!sold.length) return await ctx.reply('Ошибка получения данных из файла продаж')
                            for (const item of sold) {
                                const remainderResponse = await getRemainder(pool, item.article)
                                if (!remainderResponse.status) {
                                    resultMsg.push(remainderResponse.error)
                                } else {
                                    if (remainderResponse.data.balance < item.sold) {
                                        resultMsg.push(`Артикул ${item.article} на остатках меньше проданного - ${remainderResponse.data.balance}`)
                                    } else {
                                        const res = await setRemainder(pool, remainderResponse.data.id, remainderResponse.data.balance - item.sold)
                                        if (!res.status) resultMsg.push(res.error)
                                    }
                                }
                            }
                            if (!resultMsg.length) resultMsg.push('Обработка файла Продаж завершена.')
                            return await ctx.reply(resultMsg.join('\n'))
                        }

                        // Обрабатываем выплаты
                        if (typeFile === 'balance') {
                            if (!balance.length) return await ctx.reply('Ошибка получения данных из файла выплат')
                            const taskIdResponse = await getTaskExists(pool)
                            if (!taskIdResponse.status) return await ctx.reply(`Ошибка получения taskIdExist - ${taskIdResponse.error}`)
                            const resultMsg: string[] = []
                            for (const item of balance) {
                                const userResponse = await getUserIdByName(pool, item.userName)
                                if (userResponse.status) {
                                    const addPay = await addUserPay(pool, taskIdResponse.id, userResponse.id, -item.payout)
                                    addPay.status ? resultMsg.push(`🟢 ${item.userName} - выплата добавлена`) : resultMsg.push(`🔴 ${item.userName} ошибка - ${addPay.error}`)
                                } else {
                                    resultMsg.push(`${item.userName} - ${userResponse.error}`)
                                }
                            }
                            return await ctx.reply(resultMsg.join('\n'))
                        }

                        // Теперь у нас есть вся информация о проектах из файла и мы можем перенести ее в БД
                        // В первую очередь занесем этапы, чтобы сохранить на будущее хронологию этапов
                        for (const task of tasks) {
                            await updateStages(pool, task.name, task.order)
                        }
                        // Теперь остальную информацию
                        for (const project of projects) {
                            // Обновим ассортимент
                            const itemAssortment: IDBAssortment = {
                                article: project.article,
                                name: project.name,
                                curBalance: project.currentRemainder,
                                minBalance: project.minRemainder,
                                necessary: project.needTo,
                                priority: project.priority
                            }
                            const resultUpdateAssortment = await updateAssortment(pool, itemAssortment)
                            if (!resultUpdateAssortment.status) {
                                console.log(`[resultUpdateAssortment] ${resultUpdateAssortment.error}`)
                                continue
                            }
                            // Обновим задачи
                            let stepSequenceStage = 0
                            // Рассчитаем необходимое количество,
                            // если заполнен параметр проекта "Необходимо" - берем его
                            // иначе находим разность между минимальным остатком и текущим
                            const diffRemainder = project.minRemainder - project.currentRemainder
                            let prevMade = project.needTo ? project.needTo : diffRemainder > 0 ? diffRemainder : 0
                            for (const task of project.tasks) {
                                const getSetValue = (code: string): number => {
                                    const isSet = task.setting.filter(s => s.code === code)
                                    return isSet.length && isSet[0].value ? isSet[0].value : 0
                                }
                                // Обновляем только в том случае, если указана цена
                                const valuePrice = getSetValue('price')
                                if (!valuePrice) continue
                                // Обновим этапы
                                const resultUpdateStage = await updateStages(pool, task.name, 0)
                                if (!resultUpdateStage.status) continue
                                // Обновим последовательность выполнения этапов задачи
                                stepSequenceStage++
                                const itemSequenceStages: IDBSequenceStage = {
                                    assortId: resultUpdateAssortment.id,
                                    stageId: resultUpdateStage.id,
                                    step: stepSequenceStage
                                }
                                await updateSequenceStages(pool, itemSequenceStages)
                                let userId: number | null = null
                                const user = getSetValue('responsible')
                                // Пользователь в файле записан именем
                                if (user) {
                                    if (isNaN(Number(user))) {
                                       const temp = await getUserIdByName(pool, `${user}`)
                                       if (temp.status) userId = temp.id
                                    } else {
                                        userId = Number(user)
                                    }
                                }
                                const valueMade = getSetValue('made')
                                const isParallelRemote = getSetValue('remote')
                                // Формируем задачу
                                const itemTask: IDBTask = {
                                    assortId: resultUpdateAssortment.id,
                                    stageId: resultUpdateStage.id,
                                    userId,
                                    needTo: prevMade,
                                    made: valueMade,
                                    defect: getSetValue('defect'),
                                    remote: isParallelRemote,
                                    price: valuePrice,
                                    status: 0
                                }

                                const resultUpdateTask = await updateTask(pool, itemTask)
                                if (!resultUpdateTask.status) console.log(`Update task error - ${resultUpdateTask.error}`)
                                // Изменим необходимое количество только для не параллельных задач
                                if (isParallelRemote !== 2) prevMade = valueMade
                            }
                        }
                        return await ctx.reply('Обработка файла завершена успешно')
                    })
                })
            }
        })
    }
}