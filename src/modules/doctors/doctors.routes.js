import express from "express"
import { requireAuth } from "../../middleware/requireAuth.js"
import { getDoctors } from "./doctors.controller.js"

const router = express.Router()

router.get("/", requireAuth, getDoctors)

export default router
