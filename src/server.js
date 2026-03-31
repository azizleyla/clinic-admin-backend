import express from "express"
import cors from "cors"
import authRoutes from "./modules/auth/auth.routes.js"
import usersRoutes from "./modules/users/users.routes.js"

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

app.use("/auth", authRoutes)
app.use("/users", usersRoutes)

app.listen(5000, () => {
  console.log("Server running on port 5000")
})