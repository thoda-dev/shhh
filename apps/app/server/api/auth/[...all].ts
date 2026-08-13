import { toWebRequest } from 'h3'

export default defineEventHandler(event => auth.handler(toWebRequest(event)))
