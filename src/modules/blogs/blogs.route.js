import express from "express"
import multer from "multer"
import { requireAuth } from "../../middleware/requireAuth.js"
import { createBlog, createBlogJson, deleteBlog, editBlog, getBlogs } from "./blogs.controller.js"

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

router.get("/", requireAuth, getBlogs)
router.post("/add-json", requireAuth, createBlogJson)
router.post("/add", requireAuth, upload.single("image"), createBlog)
router.put("/edit/:id", requireAuth, upload.single("image"), editBlog)
router.delete("/delete/:id", requireAuth, deleteBlog)

export default router
