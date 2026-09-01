import { AppSuccess } from "../../common/AppSuccess.js"
import { respondHttpError } from "../../common/respondHttpError.js"
import {
  getDoctorByIdService,
  getDoctorsService,
  parseDoctorsListQuery,
  updateDoctorStatusService,
} from "./doctors.service.js"

export async function getDoctors(req, res) {
  try {
    const listQuery = parseDoctorsListQuery(req.query)
    const { items, fields } = await getDoctorsService(listQuery)
    AppSuccess.send(res, 200, items, {
      message: "Həkim siyahısı gətirildi",
      fields,
    })
  } catch (e) {
    respondHttpError(res, e)
  }
}

export async function getDoctorById(req, res) {
  try {
    const { id } = req.params ?? {}
    const doctor = await getDoctorByIdService(id)
    AppSuccess.send(res, 200, doctor, { message: "Həkim gətirildi" })
  } catch (e) {
    respondHttpError(res, e)
  }
}

export async function updateDoctorStatus(req, res) {
  try {
    const { id } = req.params ?? {}
    const { status } = req.body ?? {}
    const result = await updateDoctorStatusService(id, status)
    AppSuccess.send(res, 200, result, { message: "Həkim statusu yeniləndi" })
  } catch (e) {
    respondHttpError(res, e)
  }
}
