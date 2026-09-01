import { AppSuccess } from "../../common/AppSuccess.js"
import { respondHttpError } from "../../common/respondHttpError.js"
import {
  createDepartmentService,
  deleteDepartmentService,
  editDepartmentService,
  getDepartmentByIdService,
  getDepartmentsService,
} from "./departments.service.js"

export async function getDepartments(req, res) {
          try {
                    const result = await getDepartmentsService(req.clinicId)
                    AppSuccess.send(res, 200, result, { message: "Şöbələr  siyahısı uğurla gətirildi" })
          } catch (e) {
                    respondHttpError(res, e)
          }
}

export async function getDepartmentById(req, res) {
          try {
                    const { id } = req.params ?? {}
                    const result = await getDepartmentByIdService(id, req.clinicId)
                    AppSuccess.send(res, 200, result, { message: "Şöbə uğurla gətirildi" })
          } catch (e) {
                    respondHttpError(res, e)
          }
}

export async function createDepartment(req, res) {
          try {
                    const { title, desc, content, icon_name } = req.body ?? {}
                    const result = await createDepartmentService({
                              title,
                              desc,
                              content,
                              icon_name,
                              imageFile: req.file,
                              clinicId: req.clinicId,
                    })
                    AppSuccess.send(res, 201, result, { message: "Şöbə uğurla yaradıldı" })
          } catch (e) {
                    respondHttpError(res, e)
          }
}

export async function editDepartment(req, res) {
          try {
                    const { id } = req.params ?? {}
                    const { title, desc, content, icon_name } = req.body ?? {}
                    const result = await editDepartmentService(id, {
                              title,
                              desc,
                              content,
                              icon_name,
                              imageFile: req.file,
                    }, req.clinicId)
                    AppSuccess.send(res, 200, result, { message: "Şöbə uğurla yeniləndi" })
          } catch (e) {
                    respondHttpError(res, e)
          }
}

export async function deleteDepartment(req, res) {
          try {
                    const { id } = req.params ?? {}
                    const result = await deleteDepartmentService(id, req.clinicId)
                    AppSuccess.send(res, 200, result, { message: "Şöbə uğurla silindi" })
          } catch (e) {
                    respondHttpError(res, e)
          }
}
