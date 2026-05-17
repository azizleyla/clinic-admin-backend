import { AppSuccess } from "../../common/AppSuccess.js"
import { respondHttpError } from "../../common/respondHttpError.js"
import { getDoctorsService } from "./doctors.service.js"

export async function getDoctors(req, res) {
  try {
    const result = await getDoctorsService()
    AppSuccess.send(res, 200, result, { message: "Həkim siyahısı gətirildi" })
  } catch (e) {
    respondHttpError(res, e)
  }
}
