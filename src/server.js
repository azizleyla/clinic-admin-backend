import express from "express"
import cors from "cors"
import authRoutes from "./modules/auth/auth.routes.js"
import doctorsRoutes from "./modules/doctors/doctors.routes.js"
import usersRoutes from "./modules/users/users.routes.js"
import departmentsRoutes from "./modules/departments/departments.route.js"
import branchesRoutes from "./modules/branches/branches.routes.js"
import blogsRoutes from "./modules/blogs/blogs.route.js"
import heroSlidesRoutes from "./modules/hero_slides/hero_slides.routes.js"

const app = express()

app.use(cors({ origin: true, credentials: true }))
/** Base64 şəkil ilə JSON bloq əlavəsi üçün (Postman raw JSON) */
app.use(express.json({ limit: "15mb" }))

/**
 * Multi-tenant: hər sorğunun hansı klinikaya aid olduğunu `X-Clinic` header-dən
 * oxuyuruq. Bütün servislər `req.clinicId` ilə `clinic_id`-ə görə filtrləyir.
 */
app.use((req, _res, next) => {
  req.clinicId =
    String(req.headers["x-clinic"] || "").trim().toLowerCase() || "elmed"
  next()
})

app.use("/auth", authRoutes)
app.use("/doctors", doctorsRoutes)
app.use("/users", usersRoutes)
app.use('/departments', departmentsRoutes)
app.use('/branches', branchesRoutes)
app.use('/blogs', blogsRoutes)
app.use('/hero-slides', heroSlidesRoutes)

/** Multipart / multer parse və ümumi xətalar — HTML `<pre>` əvəzinə JSON */
app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err)
    return
  }
  const msg = String(err?.message ?? "")
  if (
    msg.includes("Malformed part header") ||
    msg.includes("Unexpected end of form") ||
    err?.code === "LIMIT_FILE_SIZE"
  ) {
    const hint =
      msg.includes("Malformed") || msg.includes("Unexpected end")
        ? "Body → form-data seçin; Headers-da Content-Type özünüz yazmayın (Postman boundary özü əlavə edir). JSON/raw ilə şəkil göndərməyin."
        : "Şəkil ən çoxu 5 MB ola bilər."
    res.status(400).json({
      message: "Multipart sorğu düzgün parse olunmadı.",
      hint,
      detail: process.env.NODE_ENV === "development" ? msg : undefined,
    })
    return
  }
  const status = err?.statusCode ?? err?.status ?? 500
  res.status(status).json({
    message: msg || "Server xətası",
  })
})

app.listen(5000, () => {
  console.log("Server running on port 5000")
})