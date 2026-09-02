import express from "express"
import { matchBranch, matchDepartment } from "./ai.controller.js"

const router = express.Router()

router.post("/match-department", matchDepartment)
router.post("/find-branch", matchBranch)

export default router
