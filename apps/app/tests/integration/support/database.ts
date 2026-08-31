import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../../server/database/schema'
import { testDatabaseUrl } from './env'

const client = postgres(testDatabaseUrl(), { onnotice: () => {} })

/** A second connection to the server's own database, for arranging rows and asserting on them. */
export const db = drizzle(client, { schema })
export { schema }

/** Truncate rather than re-migrate: the schema is applied once, at boot. */
export async function resetDatabase() {
  // Read from the catalog, so a new table is covered without editing this file.
  const tables = await client<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `
  if (tables.length === 0) return
  const list = tables.map(row => `"${row.tablename}"`).join(', ')
  await client.unsafe(`truncate table ${list} restart identity cascade`)
}

export function closeDatabase() {
  return client.end()
}
