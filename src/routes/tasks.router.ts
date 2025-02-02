import { Router, Request, Response } from 'express'
import { Pool } from 'mysql2/promise'

import { connect2tabulator } from '../db/db.promise'
import { getMyTasks, getAllTasks, getTasks, getUserIdByChatId, getUserRoles, IResultUser } from '../db/db.querys'

interface ITask {
    id: number
    assortName: string
    stageName: string
    needTo: number
    price: number
    remote: number
}

interface IMyTasks {
    id: number
    needTo: number
    price: number
    remote: number
    priority: number
    assortName: string
    stageName: string
    stageId: number
    made: number
    defect: number
    refuse: boolean
}

const router = Router()

async function getUserInfo(pool: Pool, userId: number): Promise<{ status: boolean, error: string, userInfo: IResultUser }> {
    const userIdResponse = await getUserIdByChatId(pool, userId)
    if (!userIdResponse.status) return { status: false, error: `Ошибка определения пользователя - ${userIdResponse.error}`, userInfo: {} as IResultUser }
    if (!userIdResponse.isActive) return { status: false, error: 'Доступ запрещен', userInfo: {} as IResultUser }
    return { status: true, error: '', userInfo: userIdResponse }
}

router.get('/', async (req: Request, res: Response) => {
    const pool = await connect2tabulator()
    // Составим список доступных пользователю задач
    const tasks = await getAllTasks(pool)
    if (!tasks.status) {
        res.status(400).send({ status: false, error: `Ошибка определения списка задач - ${tasks.error}` })
        return
    }
    const paramsTasks: ITask[] = []
    tasks.data.forEach(task => {
        const temp: ITask = {
            id: task.id,
            assortName: task.assortName,
            stageName: task.stageName,
            needTo: task.needTo,
            price: task.price,
            remote: task.remote
        }
        paramsTasks.push(temp)
    })

    if (!paramsTasks.length) {
        res.status(400).send({ status: false, error: 'Пустой список задач' })
    } else {
        res.json({ status: true, tasks: paramsTasks })
    }
})

router.get('/:userId', async (req: Request, res: Response) => {
    const pool = await connect2tabulator()
    const user = await getUserInfo(pool, Number(req.params.userId))
    if (!user.status) {
        res.status(400).send({ status: false, error: `Ошибка определения пользователя - ${user.error}` })
        return
    }
    // Если пользователь не является админом - запросим права для него
    const userRights: number[] = []
    if (!user.userInfo.isAdmin) {
        const userRightsResponse = await getUserRoles(pool, user.userInfo.id)
        if (!userRightsResponse.status) {
            res.status(400).send({ status: false, error: `Ошибка определения прав пользователя - ${userRightsResponse.error}` })
            return
        }
        userRightsResponse.data.forEach(r => userRights.push(r))
    }

    // Составим список доступных пользователю задач
    const tasks = await getTasks(pool)
    if (!tasks.status) {
        res.status(400).send({ status: false, error: `Ошибка определения списка задач - ${tasks.error}` })
        return
    }
    const paramsTasks: ITask[] = []
    let isPriority = false
    tasks.data.forEach(task => {
        // Проверка прав на задачу
        if (user.userInfo.isAdmin || userRights.includes(task.stageId)) {
            const temp: ITask = {
                id: task.id,
                assortName: task.assortName,
                stageName: task.stageName,
                needTo: task.needTo,
                price: task.price,
                remote: task.remote
            }
            if (task.remote === 1) {
                paramsTasks.push(temp)
            } else {
                if (!isPriority) paramsTasks.push(temp)
            }
            // Если нашли приоритетную задачу - ставим признак
            if (task.priority === 1) isPriority = true
        }
    })

    if (!paramsTasks.length) {
        res.status(400).send({ status: false, error: 'Пустой список задач' })
    } else {
        res.json({ status: true, tasks: paramsTasks })
    }
})

router.get('/my/:userId', async (req: Request, res: Response) => {
    const pool = await connect2tabulator()
    const user = await getUserInfo(pool, Number(req.params.userId))
    if (!user.status) {
        res.status(400).send({ status: false, error: `Ошибка определения пользователя - ${user.error}` })
        return
    }
    const myTasks = await getMyTasks(pool, user.userInfo.id)
    if (!myTasks.status) {
        res.status(400).send({ status: false, error: `Ошибка определения списка моих задач - ${myTasks.error}` })
        return
    }
    const paramsMyTasks: IMyTasks[] = []
    myTasks.data.forEach(m => {
        paramsMyTasks.push({
            id: m.id,
            needTo: m.needTo,
            price: m.price,
            remote: m.remote,
            priority: m.priority,
            assortName: m.assortName,
            stageName: m.stageName,
            stageId: m.stageId,
            made: 0,
            defect: 0,
            refuse: false
        })
    })

    if (!paramsMyTasks.length) {
        res.status(400).send({ status: false, error: 'Пустой список задач' })
    } else {
        res.json({ status: true, tasks: paramsMyTasks })
    }

})

export default router