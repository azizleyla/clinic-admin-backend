import express from "express"
import { requireAuth } from "../../middleware/requireAuth.js"
import { getDoctorById, getDoctors, updateDoctorStatus } from "./doctors.controller.js"

const router = express.Router()

router.get("/", getDoctors)
router.get("/:id", getDoctorById)
router.patch("/:id/status", requireAuth, updateDoctorStatus)

export default router
