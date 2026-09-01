import express from "express";
import { getBranchById, getBranches } from "./branches.controller.js";

const router = express.Router();

router.get("/", getBranches);
router.get("/:id", getBranchById);

export default router;
