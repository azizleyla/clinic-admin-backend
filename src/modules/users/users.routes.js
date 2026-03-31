import express from "express"
import { requireAuth } from "../../middleware/requireAuth.js"
import { requireRole } from "../../middleware/requireRole.js"
import {
  blockUser,
  changeUserStatus,
  createUser,
  deleteUser,
  editUser,
  getUsers,
  resendInvite,
  unblockUser,
} from "./users.controller.js"

const router = express.Router()

router.post("/add", requireAuth, requireRole("admin"), createUser)
router.put("/edit/:id", requireAuth, requireRole("admin"), editUser)

router.patch("/change-status/:id", requireAuth, requireRole("admin"), changeUserStatus)
router.patch("/resend-invite/:id", requireAuth, requireRole("admin"), resendInvite)

/** Silinəcək id URL-də: DELETE /users/:id */
router.delete("/delete/:id", requireAuth, requireRole("admin"), deleteUser)

router.get("/", requireAuth, requireRole("admin"), getUsers)

export default router
