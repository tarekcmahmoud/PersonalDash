import type { ISODateTime } from './types'

export const newId = (): string => crypto.randomUUID()
export const nowISO = (): ISODateTime => new Date().toISOString()
