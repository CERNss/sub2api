const EXTERNAL_MENU_AUTH_TOKEN_QUERY_KEY = 'token'

export function buildExternalMenuUrl(baseUrl: string, authToken?: string | null): string {
  if (!baseUrl) return baseUrl
  try {
    const url = new URL(baseUrl)
    if (authToken) {
      url.searchParams.set(EXTERNAL_MENU_AUTH_TOKEN_QUERY_KEY, authToken)
    }
    return url.toString()
  } catch {
    return baseUrl
  }
}
