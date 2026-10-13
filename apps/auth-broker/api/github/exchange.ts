import type { JsonRequest, JsonResponse } from '../../lib/github'
import {
  methodAllowed,
  publicError,
  readJsonBody,
  requestGitHubToken,
  requireBrokerConfiguration,
  requireString,
  sendJson,
} from '../../lib/github'

export default async function handler(request: JsonRequest, response: JsonResponse): Promise<void> {
  if (!methodAllowed(request, response)) return
  try {
    const body = await readJsonBody(request)
    const code = requireString(body, 'code', 8, 1024)
    const codeVerifier = requireString(body, 'codeVerifier', 43, 128)
    const requestedRedirectUri = requireString(body, 'redirectUri', 1, 256)
    const { redirectUri } = requireBrokerConfiguration()
    if (requestedRedirectUri !== redirectUri) throw new Error('Invalid redirectUri.')
    const token = await requestGitHubToken({
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    })
    sendJson(response, 200, token)
  } catch (error) {
    sendJson(response, 400, { error: publicError(error) })
  }
}
