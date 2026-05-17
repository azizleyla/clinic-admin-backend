import { AppSuccess } from "../../common/AppSuccess.js"
import { respondHttpError } from "../../common/respondHttpError.js"
import {
  blockUserAsAdmin,
  changeUserStatusAsAdmin,
  createUserAsAdmin,
  deleteUserAsAdmin,
  editUserAsAdmin,
  getUsersService,
  resendInviteAsAdmin,
  unblockUserAsAdmin,
} from "./users.service.js"

export async function editUser(req, res) {
  try {
    const { email, full_name, role, status } = req.body ?? {}
    const targetUserId = req.params.id
    const actorUserId = req.auth?.user?.id
    const result = await editUserAsAdmin({
      actorUserId,
      targetUserId,
      email,
      full_name,
      role,
      status,
    })
    AppSuccess.send(res, 200, result, {
      message: "İstifadəçi uğurla redaktə edildi",
    })
  } catch (e) {
    respondHttpError(res, e)
  }
}

export async function createUser(req, res) {
  try {
    const { email, full_name, role, password } = req.body
    const result = await createUserAsAdmin({ email, full_name, role, password })
    AppSuccess.send(res, 201, result, {
      message: "İstifadəçi uğurla yaradıldı",
    })
  } catch (e) {
    respondHttpError(res, e)
  }
}

export async function getUsers(req, res) {
  try {
    const result = await getUsersService()
    AppSuccess.send(res, 200, result)
  } catch (e) {
    respondHttpError(res, e)
  }
}

/** DELETE /users/:id — yalnız admin; öz id-sinə silmə icazəsi yoxdur (service yoxlayır). */
export async function deleteUser(req, res) {
  try {
    const targetUserId = req.params.id
    const actorUserId = req.auth?.user?.id
    const result = await deleteUserAsAdmin({ actorUserId, targetUserId })
    AppSuccess.send(res, 200, result, { message: "İstifadəçi uğurla silindi" })
  } catch (e) {
    respondHttpError(res, e)
  }
}

/** PATCH /users/block/:id — yalnız admin; öz id-sinə blok icazəsi yoxdur. */
export async function blockUser(req, res) {
  try {
    const targetUserId = req.params.id
    const actorUserId = req.auth?.user?.id
    const result = await blockUserAsAdmin({ actorUserId, targetUserId })
    AppSuccess.send(res, 200, result, { message: "İstifadəçi bloklandı" })
  } catch (e) {
    respondHttpError(res, e)
  }
}

/** PATCH /users/unblock/:id — yalnız admin. */
export async function unblockUser(req, res) {
  try {
    const targetUserId = req.params.id
    const actorUserId = req.auth?.user?.id
    const result = await unblockUserAsAdmin({ actorUserId, targetUserId })
    AppSuccess.send(res, 200, result, { message: "İstifadəçinin bloku açıldı" })
  } catch (e) {
    respondHttpError(res, e)
  }
}

/** PATCH /users/status/:id — body: { status } */
export async function changeUserStatus(req, res) {
  try {
    const targetUserId = req.params.id
    const actorUserId = req.auth?.user?.id
    const { status } = req.body ?? {}
    const result = await changeUserStatusAsAdmin({ actorUserId, targetUserId, status })
    AppSuccess.send(res, 200, result, { message: "Status yeniləndi" })
  } catch (e) {
    respondHttpError(res, e)
  }
}

/** PATCH /users/resend-invite/:id — yalnız admin; pending user üçün dəvət mailini yenidən göndərir. */
export async function resendInvite(req, res) {
  try {
    const targetUserId = req.params.id
    const result = await resendInviteAsAdmin({ targetUserId })
    AppSuccess.send(res, 200, result, { message: "Dəvət maili yenidən göndərildi" })
  } catch (e) {
    respondHttpError(res, e)
  }
}