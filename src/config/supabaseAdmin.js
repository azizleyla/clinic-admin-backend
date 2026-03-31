import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config()

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let client = null

/**
 * Service role client — yalnız çağırılanda yaradılır (açar yoxdursa server işə düşəndə crash olmur).
 * User yaratmaq kimi admin əməliyyatları üçün.
 */
export function getSupabaseAdmin() {
  if (!url || !serviceRoleKey) {
    const err = new Error(
      "SUPABASE_SERVICE_ROLE_KEY .env faylında olmalıdır (Supabase Dashboard → Settings → API → service_role)"
    )
    err.statusCode = 503
    throw err
  }
  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return client
}

/** Köhnə importlar üçün */
export function assertAdminClient() {
  getSupabaseAdmin()
}

export default getSupabaseAdmin
