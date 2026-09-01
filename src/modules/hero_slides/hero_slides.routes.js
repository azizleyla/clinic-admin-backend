import express from "express"
import multer from "multer"
import { requireAuth } from "../../middleware/requireAuth.js"
import {
  createHeroSlide,
  deleteHeroSlide,
  editHeroSlide,
  getHeroSlideById,
  getHeroSlides,
  reorderHeroSlides,
} from "./hero_slides.controller.js"

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new Error("Yalnız şəkil faylı qəbul olunur"))
      return
    }
    cb(null, true)
  },
})

router.get("/", getHeroSlides)
router.get("/:id", getHeroSlideById)
router.post("/add", requireAuth, upload.single("image"), createHeroSlide)
router.put("/edit/:id", requireAuth, upload.single("image"), editHeroSlide)
router.delete("/delete/:id", requireAuth, deleteHeroSlide)
router.put("/reorder", requireAuth, reorderHeroSlides);


export default router
