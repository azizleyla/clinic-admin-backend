import express from "express"
import supabase from "../config/supabase.js"

const router = express.Router()

router.get("/profiles", async (req, res) => {

    const { data, error } = await supabase
        .from("profiles")
        .select("*")

    if (error) {
        return res.status(500).json(error)
    }

    res.json(data)

})

export default router