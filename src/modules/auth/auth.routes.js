import express from "express"
import { login, me, setPassword } from "./auth.controller.js"
import { requireAuth } from "../../middleware/requireAuth.js"

const router = express.Router()

router.post("/login", login)
router.post("/set-password", setPassword)
router.get("/me", requireAuth, me)

export default router