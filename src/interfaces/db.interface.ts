interface IDBAssortment {
    article: string
    name: string
    minBalance: number
    curBalance: number
    necessary: number
    priority: number
}

interface IDBTask {
    assortId: number
    stageId: number
    userId: number | null
    needTo: number
    made: number
    defect: number
    remote: number
    price: number
    status: number
}

interface IDBSequenceStage {
    assortId: number
    stageId: number
    step: number
}

interface IDBTaskSelection {
    id: number
    assortName: string
    stageId: number
    stageName: string
    needTo: number
    price: number
    remote: number
    priority: number
    status: boolean
}

interface IDBStages {
    id: number
    stageName: string
}

interface IDBUsersRoles {
    userId: number
    userName: string
    isAdmin: boolean
    isActive: boolean
    stageId: number
}

export {
    IDBAssortment,
    IDBTask,
    IDBSequenceStage,
    IDBTaskSelection,
    IDBStages,
    IDBUsersRoles
}