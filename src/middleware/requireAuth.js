import { AppError } from "../common/AppError.js"
import { getUserInfoFromAccessToken } from "../modules/auth/auth.service.js"

export function extractBearerToken(req) {
  const raw = req.headers.authorization || req.headers.Authorization
  if (!raw || typeof raw !== "string") return null
  const m = raw.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

/**
 * Header: Authorization: Bearer <supabase_access_token>
 * Uğurlu olduqda: req.auth = { accessToken, user, profile, authUser }
 * authUser — Supabase User (metadata, created_at); /auth/me üçün.
 */
export async function requireAuth(req, res, next) {
  const accessToken = extractBearerToken(req)

  if (!accessToken) {
    return res.status(401).json({ message: "Authorization Bearer token tələb olunur" })
  }

  try {
    const { user, profile, authUser } = await getUserInfoFromAccessToken(accessToken)
    req.auth = { accessToken, user, profile, authUser }
    next()
  } catch (e) {
    const status = e.statusCode ?? 401
    const body = e instanceof AppError ? e.toJSON() : { message: e.message }
    return res.status(status).json(body)
  }
}
