import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'

import { IDBAssortment, IDBSequenceStage, IDBTask, IDBTaskSelection, IDBStages, IDBUsersRoles } from '../interfaces'

interface IResultUpdate {
    status: boolean
    id: number
    operation: 'new' | 'exist' | 'error'
    error: string
}

interface IResultUser {
    status: boolean
    id: number
    isAdmin: boolean
    isActive: boolean
    operation: 'new' | 'exist' | 'error'
    error: string
}

interface IResultTaskSelection {
    status: boolean
    error: string
    data: IDBTaskSelection[]
}

interface IResultStages {
    status: boolean
    error: string
    data: IDBStages[]
}

interface IResultUserRoles {
    status: boolean
    error: string
    data: IDBUsersRoles[]
}

interface IResultTaskId {
    status: boolean
    error: string
    data: number
}

interface IRootTask {
    status: boolean
    error: string
    data: {
        assortId: number
        stageId: number
        curBalance: number
        minBalance: number
        necessary: number
    }
}

interface IPackageTask {
    status: boolean
    error: string
    data: {
        assortId: number
        stageId: number
        status: number
        curBalance: number
        minBalance: number
    }
}

interface IFileTask {
    id: number
    article: string
    needTo: number
    made: number
    defect: number
    remote: number
    price: number
    status: number
    assortId: number
    assortName: string
    curBalance: number
    minBalance: number
    stageId: number
    stageName: string
    userName: string
    necessary: number
    priority: number
}

interface IFileTasks {
    status: boolean
    error: string
    data: IFileTask[]
}

interface IRemainder {
    status: boolean
    error: string
    data: {
        id: number
        balance: number
    }
}

interface IBalanceUsers {
    status: boolean
    error: string
    data: {
        userId: number
        userName: string
        balance: number
    }[]
}

async function getUserIdByName(pool: Pool, name: string): Promise<IResultUpdate> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`SELECT id FROM bot_users WHERE name = ?`, [name])
        if (resultQuery[0].length) {
            return { status: true, id: resultQuery[0][0].id, operation: 'exist', error: '' }
        } else {
            return { status: false, id: 0, operation: 'new', error: `Пользователь не найден` }
        }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function getUserIdByChatId(pool: Pool, chatId: number): Promise<IResultUser> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`SELECT id, is_admin, is_active FROM bot_users WHERE chat_id = ?`, [chatId])
        if (resultQuery[0].length) {
            return { status: true, id: resultQuery[0][0].id, isAdmin: Boolean(resultQuery[0][0].is_admin), isActive: Boolean(resultQuery[0][0].is_active),operation: 'exist', error: '' }
        } else {
            return { status: false, id: 0, isAdmin: false, isActive: false, operation: 'new', error: 'Пользователь не найден.' }
        }
    } catch (err: any) {
        return { status: false, id: 0, isAdmin: false, isActive: false, operation: 'error', error: err.message }
    }
}

async function updateAssortment(pool: Pool, item: IDBAssortment): Promise<IResultUpdate> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`SELECT id FROM bot_assortment WHERE article = ?`, [item.article])
        if (resultQuery[0].length) {
            await pool.query(`UPDATE bot_assortment 
                                SET name = ?, 
                                    min_balance = ?, 
                                    cur_balance = ?, 
                                    necessary = ?, 
                                    priority = ?
                                WHERE id = ?`,
            [item.name, item.minBalance, item.curBalance, item.necessary, item.priority, resultQuery[0][0].id])
            return { status: true, id: resultQuery[0][0].id, operation: 'exist', error: '' }
        } else {
            const resultInsert = await pool.query<ResultSetHeader>(`INSERT INTO bot_assortment (name, article, min_balance, cur_balance, necessary, priority) VALUES (?, ?, ?, ?, ?, ?)`,
                [item.name, item.article, item.minBalance, item.curBalance, item.necessary, item.priority])
            console.log(`Success add assortment: ${resultInsert[0].insertId} - ${item.name}`)
            return { status: true, id: resultInsert[0].insertId, operation: 'new', error: '' }
        }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function updateStages(pool: Pool, item: string, orderFile: number): Promise<IResultUpdate> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`SELECT id, order_file FROM bot_stages WHERE name = ?`, [item])
        if (resultQuery[0].length) {
            const data = resultQuery[0][0] as { id: number, order_file: number }
            // Если изменился порядок колонок из файла
            if (orderFile && data.order_file !== orderFile) {
                await pool.query(`UPDATE bot_stages SET order_file = ? WHERE id = ?`, [orderFile, data.id])
                console.log(`Change order for ${item}: ${data.order_file} -> ${orderFile}`)
            }
            return { status: true, id: data.id, operation: 'exist', error: '' }
        } else {
            const resultInsert = await pool.query<ResultSetHeader>(`INSERT INTO bot_stages (name, order_file) VALUES (?, ?)`, [item, orderFile])
            console.log(`Success add stage: id ${resultInsert[0].insertId}, order ${orderFile} - ${item}`)
            return { status: true, id: resultInsert[0].insertId, operation: 'new', error: '' }
        }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function updateSequenceStages(pool: Pool, item: IDBSequenceStage): Promise<IResultUpdate> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`SELECT id, step FROM sequence_stages WHERE assort_id = ? AND stage_id = ?`,
            [item.assortId, item.stageId])
        if (resultQuery[0].length) {
            const data = resultQuery[0][0] as { id: number, step: number }
            // Если изменился порядок выполнения задач
            if (item.step !== data.step) {
                await pool.query(`UPDATE sequence_stages SET step = ? WHERE id = ?`, [item.step, data.id])
                console.log(`Change step for aID ${item.assortId}, sID ${item.stageId}: ${data.step} -> ${item.step}`)
            }
            return { status: true, id: data.id, operation: 'exist', error: '' }
        } else {
            const resultInsert = await pool.query<ResultSetHeader>(`INSERT INTO sequence_stages (assort_id, stage_id, step) VALUES (?, ?, ?)`,
                [item.assortId, item.stageId, item.step])
            return { status: true, id: resultInsert[0].insertId, operation: 'new', error: '' }
        }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function updateTask(pool: Pool, item: IDBTask): Promise<IResultUpdate> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`SELECT id, status, needto AS needTo FROM bot_tasks WHERE assort_id = ? AND stage_id = ?`,
            [item.assortId, item.stageId])
        if (resultQuery[0].length) {
            const row = resultQuery[0][0] as { id: number, status: number, needTo: number }
            // Если данная задача занята - обновим необходимое количество
            if (row.status === 1) {
                await pool.query(`UPDATE bot_tasks SET needto = ? WHERE id = ?`, [item.needTo + row.needTo, row.id])
            } else {
                await pool.query(`UPDATE bot_tasks 
                                SET user_id = ?,
                                    needto = ?,
                                    made = ?,
                                    defect = ?,
                                    remote = ?, 
                                    price = ?                                    
                                WHERE id = ?`,
                    [item.userId, item.needTo, item.made, item.defect, item.remote, item.price, row.id])
            }
            return { status: true, id: row.id, operation: 'exist', error: '' }
        } else {
            const resultInsert = await pool.query<ResultSetHeader>(`INSERT INTO bot_tasks (assort_id, stage_id, user_id, needto, made, defect, remote, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [item.assortId, item.stageId, item.userId, item.needTo, item.made, item.defect, item.remote, item.price])
            return { status: true, id: resultInsert[0].insertId, operation: 'new', error: '' }
        }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function refuseTask(pool: Pool, id: number): Promise<IResultUpdate> {
    try {
        await pool.query(`UPDATE bot_tasks SET user_id = null, status = 0 WHERE id = ?`, [id])
        return { status: true, id, operation: 'exist', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function closeTask(pool: Pool, taskId: number, made: number, defect: number): Promise<IResultUpdate> {
    try {
        await pool.query(`UPDATE bot_tasks SET status = 2, made = ?, defect = ? WHERE id = ?`, [made, defect, taskId])
        return { status: true, id: taskId, operation: 'exist', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function addHistory(pool: Pool, userId: number, assortName: string, stageName: string, quantity: number, price: number, sum: number): Promise<IResultUpdate> {
    try {
        const resultInsert = await pool.query<ResultSetHeader>(`INSERT INTO history_tasks (user_id, assort_name, stage_name, quantity, price, sum) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, assortName, stageName, quantity, price, sum])
        return { status: true, id: resultInsert[0].insertId, operation: 'new', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function getAllTasks(pool: Pool): Promise<IResultTaskSelection> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
                                                        SELECT bt.id, 
                                                               bt.needto, 
                                                               bt.price, 
                                                               bt.remote,
                                                               bt.status,
                                                               bt.stage_id,
                                                               ba.priority, 
                                                               ba.name AS assortName, 
                                                               bs.name AS stageName
                                                        FROM bot_tasks AS bt
                                                        LEFT JOIN bot_assortment AS ba ON bt.assort_id = ba.id
                                                        LEFT JOIN bot_stages AS bs ON bt.stage_id = bs.id
                                                        ORDER BY bt.id
                                                    `)
        const data: IDBTaskSelection[] = [];
        resultQuery[0].forEach(task => {
            data.push({
                id: task.id,
                assortName: task.assortName,
                stageId: task.stage_id,
                stageName: task.stageName,
                price: task.price,
                needTo: task.needto,
                remote: task.remote,
                priority: task.priority,
                status: Boolean(task.status)
            })
        })
        return { status: true, data, error: '' }
    } catch (err: any) {
        return { status: false, data: [], error: err.message }
    }
}

async function getTasks(pool: Pool): Promise<IResultTaskSelection> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
                                                        SELECT bt.id, 
                                                               bt.needto, 
                                                               bt.price, 
                                                               bt.remote,
                                                               bt.status,
                                                               bt.stage_id,
                                                               ba.priority, 
                                                               ba.name AS assortName, 
                                                               bs.name AS stageName
                                                        FROM bot_tasks AS bt
                                                        LEFT JOIN bot_assortment AS ba ON bt.assort_id = ba.id
                                                        LEFT JOIN bot_stages AS bs ON bt.stage_id = bs.id
                                                        WHERE bt.needto > 0 AND bt.status = 0
                                                        ORDER BY ba.priority
                                                    `)
        const data: IDBTaskSelection[] = [];
        resultQuery[0].forEach(task => {
            data.push({
                id: task.id,
                assortName: task.assortName,
                stageId: task.stage_id,
                stageName: task.stageName,
                price: task.price,
                needTo: task.needto,
                remote: task.remote,
                priority: task.priority,
                status: Boolean(task.status)
            })
        })
        return { status: true, data, error: '' }
    } catch (err: any) {
        return { status: false, data: [], error: err.message }
    }
}

async function getMyTasks(pool: Pool, userId: number): Promise<IResultTaskSelection> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
                                                        SELECT bt.id, 
                                                               bt.needto, 
                                                               bt.price, 
                                                               bt.remote,
                                                               bt.status,
                                                               bt.stage_id,
                                                               ba.priority, 
                                                               ba.name AS assortName, 
                                                               bs.name AS stageName
                                                        FROM bot_tasks AS bt
                                                        LEFT JOIN bot_assortment AS ba ON bt.assort_id = ba.id
                                                        LEFT JOIN bot_stages AS bs ON bt.stage_id = bs.id
                                                        LEFT JOIN bot_users AS bu ON bt.user_id = bu.id                                                        
                                                        WHERE bt.user_id = ${userId} AND bt.status = 1 AND bu.is_active = 1
                                                    `)
        const data: IDBTaskSelection[] = [];
        resultQuery[0].forEach(task => {
            data.push({
                id: task.id,
                assortName: task.assortName,
                stageId: task.stage_id,
                stageName: task.stageName,
                price: task.price,
                needTo: task.needto,
                remote: task.remote,
                priority: task.priority,
                status: Boolean(task.status)
            })
        })
        return { status: true, data, error: '' }
    } catch (err: any) {
        return { status: false, data: [], error: err.message }
    }
}

async function getTask(pool: Pool, taskId: string): Promise<IResultTaskSelection> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
                                                        SELECT bt.id, 
                                                               bt.needto, 
                                                               bt.price, 
                                                               bt.remote,
                                                               bt.status,
                                                               bt.stage_id,
                                                               ba.priority, 
                                                               ba.name AS assortName, 
                                                               bs.name AS stageName
                                                        FROM bot_tasks AS bt
                                                        LEFT JOIN bot_assortment AS ba ON bt.assort_id = ba.id
                                                        LEFT JOIN bot_stages AS bs ON bt.stage_id = bs.id
                                                        WHERE bt.id = ?
                                                    `, [taskId])
        const data: IDBTaskSelection[] = [];
        resultQuery[0].forEach(task => {
            data.push({
                id: task.id,
                assortName: task.assortName,
                stageId: task.stage_id,
                stageName: task.stageName,
                price: task.price,
                needTo: task.needto,
                remote: task.remote,
                priority: task.priority,
                status: Boolean(task.status)
            })
        })
        return { status: true, data, error: '' }
    } catch (err: any) {
        return { status: false, data: [], error: err.message }
    }
}

async function nextTask(pool: Pool, taskId: number): Promise<IResultTaskId> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
            SELECT bt.id FROM bot_tasks AS bt
            LEFT JOIN sequence_stages AS ss ON bt.assort_id = ss.assort_id AND bt.stage_id = ss.stage_id
            WHERE bt.assort_id IN (SELECT assort_id FROM bot_tasks WHERE id = ?)
            ORDER BY ss.step`, [taskId])
        if (resultQuery[0].length) {
            // Получаем список id задач по порядку шагов и ищем следующую после текущей
            let isCurrentTask = false
            for (const item of resultQuery[0]) {
                if (isCurrentTask) return { status: true, data: item.id, error: '' }
                if (item.id === taskId) isCurrentTask = true
            }
            return { status: true, data: 0, error: '' }
        } else {
            return { status: true, data: 0, error: '' }
        }
    } catch (err: any) {
        return { status: false, data: 0, error: err.message }
    }
}

async function nextStep(pool: Pool, nextTaskId: number, madePrevStep: number): Promise<IResultUpdate> {
    try {
        await pool.query(`UPDATE bot_tasks SET needto = ? WHERE id = ?`, [madePrevStep, nextTaskId])
        return { status: true, id: nextTaskId, operation: 'exist', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function getRootTask(pool: Pool, taskId: number): Promise<IRootTask> {
    const defaultResult = { assortId: 0, stageId: 0, curBalance: 0, minBalance: 0, necessary: 0 }
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
            SELECT bt.assort_id, ba.cur_balance, ba.min_balance, ba.necessary, ss.stage_id
            FROM bot_tasks AS bt
            LEFT JOIN bot_assortment AS ba ON bt.assort_id = ba.id
            LEFT JOIN sequence_stages AS ss ON bt.assort_id = ss.assort_id AND ss.step = 1
            WHERE bt.id = ?`,
            [taskId])
        if (resultQuery[0].length) {
            const v = resultQuery[0][0]
            return { status: true, data: { assortId: v.assort_id, stageId: v.stage_id, curBalance: v.cur_balance, minBalance: v.min_balance, necessary: v.necessary }, error: '' }
        } else {
            return { status: false, data: defaultResult, error: '' }
        }
    } catch (err: any) {
        return { status: false, data: defaultResult, error: err.message }
    }
}

async function takeTask(pool: Pool, taskId: number, userId: number): Promise<IResultUpdate> {
    try {
        await pool.query<ResultSetHeader>(`UPDATE bot_tasks SET user_id = ?, status = 1 WHERE id = ?`,
            [userId, taskId])
        return { status: true, id: taskId, operation: 'exist', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }

}

async function updateProject(pool: Pool, assortId: number, balance: number): Promise<IResultUpdate> {
    try {
        await pool.query(`UPDATE bot_assortment SET cur_balance = ?, necessary = 0 WHERE id = ?`, [balance, assortId])
        return { status: true, id: assortId, operation: 'exist', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function resetProjectTask(pool: Pool, assortId: number): Promise<IResultUpdate> {
    try {
        await pool.query(`UPDATE bot_tasks SET user_id = null, needto = 0, made = 0, defect = 0, status = 0 WHERE assort_id = ?`, [assortId])
        return { status: true, id: assortId, operation: 'exist', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function rebootProject(pool: Pool, assortId: number, stageId: number, needTo: number): Promise<IResultUpdate> {
    try {
        await pool.query(`UPDATE bot_tasks SET needto = ? WHERE assort_id = ? AND stage_id = ?`, [needTo, assortId, stageId])
        return { status: true, id: assortId, operation: 'exist', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function getStages(pool: Pool): Promise<IResultStages> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>('SELECT * FROM bot_stages ORDER BY order_file', [])
        const data: IDBStages[] = [];
        resultQuery[0].forEach(s => {
            data.push({
                id: s.id,
                stageName: s.name,
            })
        })
        return { status: true, data, error: '' }
    } catch (err: any) {
        return { status: false, data: [], error: err.message }
    }
}

async function clearUserStages(pool: Pool, userId: number): Promise<IResultUpdate> {
    try {
        await pool.query(`DELETE FROM users_roles WHERE user_id = ?`, [userId])
        return { status: true, id: userId, operation: 'exist', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function addUserStage(pool: Pool, userId: number, roleId: number): Promise<IResultUpdate> {
    try {
        const resultInsert = await pool.query<ResultSetHeader>(`INSERT INTO users_roles (user_id, role_id) VALUES (?, ?)`, [userId, roleId])
        return { status: true, id: resultInsert[0].insertId, operation: 'new', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function changeAdminActive(pool: Pool, userId: number, isAdmin: boolean, isActive: boolean): Promise<IResultUpdate> {
    try {
        await pool.query(`UPDATE bot_users SET is_admin = ?, is_active = ? WHERE id = ?`, [isAdmin, isActive, userId])
        return { status: true, id: userId, operation: 'exist', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function getUsersRoles(pool: Pool): Promise<IResultUserRoles> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
            SELECT bu.id, bu.name, bu.is_admin AS isAdmin, bu.is_active AS isActive, ur.role_id AS stageId
            FROM bot_users AS bu
            LEFT JOIN users_roles AS ur ON bu.id = ur.user_id
            ORDER BY bu.id
        `, [])
        const data: IDBUsersRoles[] = [];
        resultQuery[0].forEach(u => {
            data.push({
                userId: u.id,
                userName: u.name,
                isAdmin: Boolean(u.isAdmin),
                isActive: Boolean(u.isActive),
                stageId: u.stageId ? u.stageId : 0
            })
        })
        return { status: true, data, error: '' }
    } catch (err: any) {
        return { status: false, data: [], error: err.message }
    }
}

async function getUserRoles(pool: Pool, userId: number): Promise<{ status: boolean, data: number[], error: string }> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`SELECT role_id FROM users_roles WHERE user_id = ${userId}`, [])
        const data: number[] = [];
        resultQuery[0].forEach(r => data.push(r.role_id))
        return { status: true, data, error: '' }
    } catch (err: any) {
        return { status: false, data: [], error: err.message }
    }
}

async function getPackageTask(pool: Pool): Promise<IPackageTask> {
    const data = { assortId: 0, stageId: 0, status: 1, minBalance: 0, curBalance: 0 }
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
            SELECT bt.assort_id, bt.stage_id, bt.status, ba.min_balance, ba.cur_balance
            FROM bot_assortment AS ba
            LEFT JOIN sequence_stages AS ss ON ba.id = ss.assort_id
            LEFT JOIN bot_tasks AS bt ON bt.assort_id = ss.assort_id AND bt.stage_id = ss.stage_id
            WHERE ss.step = 1 AND ba.name LIKE ?`, ['%(упак.)%'])
        if (resultQuery[0].length) {
            const v = resultQuery[0][0]
            return { status: true, data: { assortId: v.assort_id, stageId: v.stage_id, status: v.status, minBalance: v.min_balance, curBalance: v.cur_balance }, error: '' }
        } else {
            return { status: false, data, error: 'Не найдена задача упаковки' }
        }
    } catch (err: any) {
        return { status: false, data, error: err.message }
    }
}

async function getFileTasks(pool: Pool): Promise<IFileTasks> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
            SELECT bt.id,
                   bt.needto,
                   bt.made,
                   bt.defect,
                   bt.remote,
                   bt.price,
                   bt.status,
                   ba.id AS assortId,
                   ba.article,
                   ba.name AS assortName,
                   ba.min_balance,
                   ba.cur_balance,
                   ba.necessary,
                   ba.priority,
                   bs.id   AS stageId,
                   bs.name AS stageName,
                   bu.name AS userName
            FROM bot_tasks AS bt
            LEFT JOIN bot_assortment AS ba ON bt.assort_id = ba.id
            LEFT JOIN bot_stages AS bs ON bt.stage_id = bs.id
            LEFT JOIN bot_users AS bu ON bt.user_id = bu.id
            ORDER BY ba.id        
        `)
        if (resultQuery[0].length) {
            const data: IFileTask[] = []
            resultQuery[0].forEach(i => {
                data.push({
                    id: i.id,
                    needTo: i.needto,
                    made: i.made,
                    defect: i.defect,
                    remote: i.remote,
                    price: i.price,
                    status: i.status,
                    assortId: i.assortId,
                    article: i.article,
                    assortName: i.assortName,
                    minBalance: i.min_balance,
                    curBalance: i.cur_balance,
                    necessary: i.necessary,
                    priority: i.priority,
                    stageId: i.stageId,
                    stageName: i.stageName,
                    userName: i.userName
                })
            })
            return { status: true, data, error: '' }
        } else {
            return { status: false, data: [], error: 'Пустой результат' }
        }
    } catch (err: any) {
        return { status: false, data: [], error: err.message }
    }
}

async function getRemainder(pool: Pool, assortmentArticle: string): Promise<IRemainder> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`SELECT id, cur_balance AS balance FROM bot_assortment WHERE article = ?`, [assortmentArticle])
        if (resultQuery[0].length) {
            const data = resultQuery[0][0] as { id: number, balance: number }
            return { status: true, error: '', data }
        } else {
            return { status: false, error: `Артикул ${assortmentArticle} не найден`, data: { id: 0, balance: 0 } }
        }
    } catch (err: any) {
        return { status: false, data: { id: 0, balance: 0 }, error: err.message }
    }
}

async function setRemainder(pool: Pool, assortId: number, balance: number): Promise<IResultUpdate> {
    try {
        await pool.query(`UPDATE bot_assortment SET cur_balance = ? WHERE id = ?`, [balance, assortId])
        return { status: true, id: assortId, operation: 'exist', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

async function getBalanceSumUser(pool: Pool, userId: number): Promise<{ status: boolean, error: string, balance: number }> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
            SELECT ht.user_id AS userId, sum(ht.sum) AS balance
            FROM history_tasks AS ht
            WHERE ht.user_id = ?
            GROUP BY ht.user_id
        `, [userId])
        if (resultQuery[0].length) {
            const data = resultQuery[0][0] as { userId: number, balance: number }
            return { status: true, error: '', balance: data.balance }
        } else {
            return { status: true, error: '', balance: 0 }
        }
    } catch (err: any) {
        return { status: false, error: err.message, balance: 0 }
    }
}

async function getBalanceUsers(pool: Pool): Promise<IBalanceUsers> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>(`
            SELECT ht.user_id AS userId, u.name AS userName, sum(ht.sum) AS balance
            FROM bot_users AS u
            LEFT JOIN history_tasks AS ht ON u.id = ht.user_id
            GROUP BY ht.user_id, u.name`, [])
        if (resultQuery[0].length) {
            const data = resultQuery[0] as { userId: number, userName: string, balance: number }[]
            return { status: true, error: '', data }
        } else {
            return { status: false, error: 'Нет данных', data: [] }
        }
    } catch (err: any) {
        return { status: false, error: err.message, data: [] }
    }
}

async function getTaskExists(pool: Pool): Promise<{ status: boolean, error: string, id: number }> {
    try {
        const resultQuery = await pool.query<RowDataPacket[]>('SELECT id FROM bot_tasks ORDER BY id LIMIT 1', [])
        if (resultQuery[0].length) {
            const data = resultQuery[0][0] as { id: number }
            return { status: true, error: '', id: data.id }
        } else {
            return { status: false, error: 'Нет данных', id: 0 }
        }
    } catch (err: any) {
        return { status: false, error: err.message, id: 0 }
    }
}

async function addUserPay(pool: Pool, taskId: number, userId: number, payout: number): Promise<IResultUpdate> {
    try {
        const resultInsert = await pool.query<ResultSetHeader>(`INSERT INTO history_tasks (task_id, user_id, sum) VALUES (?, ?, ?)`, [taskId, userId, payout])
        return { status: true, id: resultInsert[0].insertId, operation: 'new', error: '' }
    } catch (err: any) {
        return { status: false, id: 0, operation: 'error', error: err.message }
    }
}

export {
    IResultUser,
    getUserIdByName,
    getUserIdByChatId,
    updateAssortment,
    updateStages,
    updateSequenceStages,
    updateTask,
    getAllTasks,
    getTasks,
    getTask,
    takeTask,
    getMyTasks,
    refuseTask,
    closeTask,
    nextTask,
    nextStep,
    addHistory,
    getRootTask,
    updateProject,
    resetProjectTask,
    rebootProject,
    getStages,
    getUsersRoles,
    changeAdminActive,
    clearUserStages,
    addUserStage,
    getUserRoles,
    getPackageTask,
    getFileTasks,
    getRemainder,
    setRemainder,
    getBalanceSumUser,
    getBalanceUsers,
    getTaskExists,
    addUserPay
}
