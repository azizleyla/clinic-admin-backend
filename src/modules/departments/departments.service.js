import { AppError } from "../../common/AppError.js";
import getSupabaseAdmin from "../../config/supabaseAdmin.js";

export async function getDepartmentsService() {
          const supabaseAdmin = getSupabaseAdmin();
          const { data: departments, error } = await supabaseAdmin.from('departments').select("*")
          if (error) {
                    throw new AppError(error.message || "Həkim siyahısı alına bilmədi", 500)

          }
          return departments ?? []

}