import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const queryClient = postgres(process.env.DATABASE_URL)

export const db = drizzle(queryClient, { schema })
export { schema }

export {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  and,
  or,
  not,
  isNull,
  isNotNull,
  inArray,
  notInArray,
  like,
  ilike,
  between,
  asc,
  desc,
  count,
  sum,
  avg,
  max,
  min,
  sql,
} from 'drizzle-orm'
