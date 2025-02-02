import { Markup, Telegraf } from 'telegraf'
import xlsx from 'node-xlsx'

import { Command } from './command.class'
import { IBotContext } from '../context/context.interface'
import { connect2tabulator } from '../db/db.promise'
import { getUserIdByChatId, getStages, getFileTasks } from '../db/db.querys'

export class FileTasksCommand extends Command {
    constructor(bot: Telegraf<IBotContext>) {
        super(bot)
    }

    handle(): void {
        this.bot.hears('Скачать файл заданий', async (ctx) => {
            const pool = await connect2tabulator()
            // Проверка пользователя
            const userIdResponse = await getUserIdByChatId(pool, ctx.message.chat.id)
            if (!userIdResponse.status) return await ctx.reply(`Ошибка определения пользователя - ${userIdResponse.error}`)
            if (!userIdResponse.isActive || !userIdResponse.isAdmin) return await ctx.reply('Доступ запрещен')
            // Получаем список всех этапов
            const stagesResponse = await getStages(pool)
            if (!stagesResponse.status) return await ctx.reply(`Ошибка определения списка этапов - ${stagesResponse.error}`)
            // Получаем текущую информацию по складу
            const infoResponse = await getFileTasks(pool)
            if (!infoResponse.status) return await ctx.reply(`Ошибка получения данных склада - ${infoResponse.error}`)
            // Все данные на месте - начинаем формировать массив для xlsx
            // @ts-ignore
            const xlsxData = []
            let rangeCount = 0
            const xlsxRanges: { s: { c: number, r: number }, e: { c: number, r: number } }[] = []
            const firstRow = ['', '', '', '', '', '']
            const secondRow = ['Артикул', 'Наименование', 'Минимальный остаток', 'Текущий остаток', 'Необходимо', 'Приоритет']
            stagesResponse.data.forEach(i => {
                // Формируем объединение строк
                const newRange = { s: { c: 6 + (rangeCount * 5), r: 0 }, e: { c: 10 + (rangeCount * 5), r: 0 } }
                xlsxRanges.push(newRange)
                rangeCount++
                // Формируем первую строку
                firstRow.push(i.stageName)
                firstRow.push('')
                firstRow.push('')
                firstRow.push('')
                firstRow.push('')
                // Формируем вторую строку
                secondRow.push('сделано')
                secondRow.push('брак')
                secondRow.push('удаленная')
                secondRow.push('ответственный')
                secondRow.push('цена')
            })
            xlsxData.push(firstRow)
            xlsxData.push(secondRow)
            // Формируем основную часть данных
            let item: any[] = []
            let currentId = 0
            infoResponse.data.forEach(row => {
                if (currentId !== row.assortId) {
                    if (currentId) {
                        xlsxData.push([...item])
                    }
                    item = []
                    item.push(row.article)
                    item.push(row.assortName)
                    item.push(row.minBalance)
                    item.push(row.curBalance)
                    item.push(row.necessary)
                    item.push(row.priority)

                    let indexStage = 0
                    stagesResponse.data.forEach((i, index) => {
                        if (i.id === row.stageId) indexStage = index
                        item.push('')
                        item.push('')
                        item.push('')
                        item.push('')
                        item.push('')
                    })
                    // Найдем индекс задачи
                    item[6 + indexStage * 5] = row.made ? row.made : ''
                    item[7 + indexStage * 5] = row.defect ? row.defect : ''
                    item[8 + indexStage * 5] = row.remote ? row.remote : ''
                    item[9 + indexStage * 5] = row.userName ? row.userName : ''
                    item[10 + indexStage * 5] = row.price ? row.price : ''
                    currentId = row.assortId
                } else {
                    let indexStage = 0
                    stagesResponse.data.forEach((i, index) => {
                        if (i.id === row.stageId) indexStage = index
                    })
                    item[6 + indexStage * 5] = row.made ? row.made : ''
                    item[7 + indexStage * 5] = row.defect ? row.defect : ''
                    item[8 + indexStage * 5] = row.remote ? row.remote : ''
                    item[9 + indexStage * 5] = row.userName ? row.userName : ''
                    item[10 + indexStage * 5] = row.price ? row.price : ''
                }
            })
            xlsxData.push([...item])
            // Формируем и отправляем сам файл
            const sheetOptions = { '!merges': xlsxRanges }
            // @ts-ignore
            const buffer = xlsx.build([{name: 'tasks', data: xlsxData}], {sheetOptions})
            await ctx.replyWithDocument({source: buffer, filename: 'tasks.xlsx'})
        })
    }
}