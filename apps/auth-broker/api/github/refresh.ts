import type { JsonRequest, JsonResponse } from '../../lib/github'
import { methodAllowed, publicError, readJsonBody, requestGitHubToken, requireString, sendJson } from '../../lib/github'

export default async function handler(request: JsonRequest, response: JsonResponse): Promise<void> {
  if (!methodAllowed(request, response)) return
  try {
    const body = await readJsonBody(request)
    const refreshToken = requireString(body, 'refreshToken', 8, 2048)
    const token = await requestGitHubToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    sendJson(response, 200, token)
  } catch (error) {
    sendJson(response, 400, { error: publicError(error) })
  }
}
