import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const queryClient = postgres(process.env.DATABASE_URL, {
  // postgres-js prints server NOTICEs to stdout by default. The only ones this app ever produces
  // are the "already exists, skipping" pair from the migrator's `CREATE ... IF NOT EXISTS`, which
  // it emits on every single boot — pure noise that reads like an error in a self-hoster's logs.
  // Warnings and errors are unaffected; they arrive as thrown errors, not notices.
  onnotice: () => {}
})

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
