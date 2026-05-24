import { AppError } from "../../common/AppError.js"
import getSupabaseAdmin from "../../config/supabaseAdmin.js"

/**
 * Doctors siyahısı — `departments` ilə nested join.
 * Cavabda hər həkim üçün düz `department` (ad) sahəsi olacaq.
 */
export async function getDoctorsService() {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: doctors, error } = await supabaseAdmin
    .from("doctors")
    .select("*, departments(id, title)")

  if (error) {
    throw new AppError(error.message || "Həkim siyahısı alına bilmədi", 500)
  }

  // `departments.title` lokal obyekti gəlir: { az, en, ru }
  // Frontend `row.department` ilə işləsin deyə nested obyekti flat edirik.
  const normalized = (doctors ?? []).map((doctor) => {
    const { departments, ...rest } = doctor
    return {
      ...rest,
      department: departments?.title ?? null,
    }
  })

  return normalized
}
