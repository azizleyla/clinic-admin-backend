import { AppError } from "../../common/AppError.js"
import getSupabaseAdmin from "../../config/supabaseAdmin.js"

/**
 * Doctors listəsi ayrıca `doctors` cədvəlindən alınır.
 */
export async function getDoctorsService() {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: doctors, error } = await supabaseAdmin
    .from("doctors")
    .select("*")

  if (error) {
    throw new AppError(error.message || "Həkim siyahısı alına bilmədi", 500)
  }

  return doctors ?? []
}
