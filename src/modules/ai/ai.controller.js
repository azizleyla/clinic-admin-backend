import { AppSuccess } from "../../common/AppSuccess.js"
import { respondHttpError } from "../../common/respondHttpError.js"
import { matchBranchByLocationService, matchDepartmentBySymptomService } from "./ai.service.js"

export async function matchDepartment(req, res) {
  try {
    const { symptom } = req.body ?? {}
    console.log('rinn')
    const result = await matchDepartmentBySymptomService(symptom)
    AppSuccess.send(res, 200, result, { message: "Sorğu uğurla emal olundu" })
  } catch (e) {
    respondHttpError(res, e)
  }
}

export async function matchBranch(req, res) {
  try {
    const { location } = req.body ?? {}
    const result = await matchBranchByLocationService(location)
    AppSuccess.send(res, 200, result, { message: "Sorğu uğurla emal olundu" })
  } catch (e) {
    respondHttpError(res, e)
  }
}