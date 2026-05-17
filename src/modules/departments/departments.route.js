import express from "express"
import { requireAuth } from "../../middleware/requireAuth.js"
import { getDepartments } from "./departments.controller.js"

const router = express.Router()

router.get("/", requireAuth, getDepartments)

export default router
