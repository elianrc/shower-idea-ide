import type { JsonRequest, JsonResponse } from '../lib/github'
import { sendJson } from '../lib/github'

export default function handler(request: JsonRequest, response: JsonResponse): void {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    sendJson(response, 405, { error: 'Method not allowed.' })
    return
  }
  sendJson(response, 200, { ok: true })
}
