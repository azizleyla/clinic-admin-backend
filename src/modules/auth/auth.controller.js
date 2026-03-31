import { AppSuccess } from "../../common/AppSuccess.js"
import { respondHttpError } from "../../common/respondHttpError.js"
import { extractBearerToken } from "../../middleware/requireAuth.js"
import {
  buildMeData,
  loginUser,
  setPasswordWithAccessToken,
} from "./auth.service.js"

export async function login(req, res) {
  try {
    const { email, password } = req.body
    const result = await loginUser(email, password)
    AppSuccess.send(res, 200, result)
  } catch (error) {
    res.status(401).json({ message: error.message })
  }
}

export function me(req, res) {
  const { authUser, profile } = req.auth
  const data = buildMeData(authUser, profile)
  AppSuccess.send(res, 200, data, {
    message: "İstifadəçi məlumatları gətirildi",
  })
}

export async function setPassword(req, res) {
  try {
    const accessToken = extractBearerToken(req)
    if (!accessToken) {
      return res.status(401).json({ message: "Authorization Bearer token tələb olunur" })
    }
    const { password } = req.body
    const result = await setPasswordWithAccessToken(accessToken, password)
    AppSuccess.send(res, 200, result)
  } catch (e) {
    respondHttpError(res, e)
  }
}
