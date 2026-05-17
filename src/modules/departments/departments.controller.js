import { AppSuccess } from "../../common/AppSuccess.js"
import { respondHttpError } from "../../common/respondHttpError.js"
import { getDepartmentsService } from "./departments.service.js"

export async function getDepartments(req, res) {
          try {
                    const result = await getDepartmentsService()
                    AppSuccess.send(res, 200, result, { message: "Şöbələr  siyahısı uğurla gətirildi" })
          } catch (e) {
                    respondHttpError(res, e)
          }
}
