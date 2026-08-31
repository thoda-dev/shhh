import { afterAll } from 'vitest'
import { closeDatabase } from './database'

// Runs in every worker: the global teardown lives in another process and cannot reach this pool.
afterAll(closeDatabase)
