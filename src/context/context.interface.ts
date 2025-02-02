import { Context } from 'telegraf'

export interface ISessionData {
    courseLike: boolean
}
export interface IBotContext extends Context {
    session: ISessionData
}