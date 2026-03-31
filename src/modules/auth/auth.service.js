import { AppError } from "../../common/AppError.js"
import supabase, { createSupabaseForAccessToken } from "../../config/supabase.js"
import getSupabaseAdmin from "../../config/supabaseAdmin.js"

/** Supabase User → API üçün açıq, stabil forma (lazy sızıntı azaldır) */
export function toPublicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
  }
}

/** Rol əsasında müvəqqəti icazə siyahısı (sonradan DB/policy ilə əvəz oluna bilər). */
function permissionsForRole(role) {
  const r = String(role ?? "").toLowerCase()
  if (r === "super_admin") {
    return ["add_user", "delete_user", "manage_settings"]
  }
  if (r === "admin") {
    return ["manage_users",  "manage_settings"]
  }
  if (r === "doctor") {
    return ["view_patients", "manage_appointments"]
  }
  return []
}

/**
 * GET /auth/me üçün vahid payload (Supabase auth user + profiles sətri).
 */
export function buildMeData(authUser, profile) {
  const meta = authUser?.user_metadata ?? {}
  const avatar =
    meta.avatar_url ??
    meta.picture ??
    meta.avatar ??
    null

  return {
    id: authUser?.id ?? profile?.id ?? null,
    email: authUser?.email ?? null,
    full_name: profile?.full_name ?? meta.full_name ?? null,
    avatar_url: typeof avatar === "string" && avatar.length > 0 ? avatar : null,
    role: profile?.role ?? null,
    permissions: permissionsForRole(profile?.role),
    created_at: authUser?.created_at ?? null,
    is_verified: Boolean(authUser?.email_confirmed_at),
  }
}

/** Login-dən sonra client saxlayır; sonrakı sorğularda Authorization: Bearer <access_token> */
function toSessionPayload(session) {
  if (!session) return null
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type ?? "bearer",
  }
}

export async function loginUser(email, password) {
  if (!email || !password) {
    throw new Error("Email və şifrə tələb olunur")
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password,
  })

  if (error || !data?.user) {
    throw new Error("Email və ya şifrə yanlışdır")
  }


  const session = toSessionPayload(data.session)
  if (!session?.access_token) {
    throw new Error("Sessiya yaradıla bilmədi")
  }

  // Dəvət + pending profil: ilk uğurlu girişdən sonra aktiv sayılır (şifrə Auth tərəfdədir).
  try {
    const admin = getSupabaseAdmin()
    const { data: row } = await admin
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle()
    if (row?.status === "pending") {
      await admin.from("profiles").update({ status: "active" }).eq("id", data.user.id)
    }
  } catch {
    // service_role yoxdursa və ya yeniləmə alınmazsa login yenə də uğurlu qalsın
  }

  return {
    user: toPublicUser(data.user),
    session,
  }
}

/** Bearer JWT ilə cari istifadəçi + profil (protected route-lar üçün) */
export async function getUserInfoFromAccessToken(accessToken) {
  const { data: { user }, error } = await supabase.auth.getUser(accessToken)

  if (error || !user) {
    throw new AppError("Yanlış və ya bitmiş token", 401)
  }

  const supabaseAsUser = createSupabaseForAccessToken(accessToken)
  const { data: profile, error: profileError } = await supabaseAsUser
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    throw new AppError("Profil məlumatı alına bilmədi", 500)
  }

  return {
    user: toPublicUser(user),
    profile: profile ?? null,
    authUser: user,
  }
}

/**
 * Dəvət linkindən gələn access_token ilə şifrə təyin etmə (frontend: Authorization: Bearer …).
 * Supabase admin ilə şifrə yazılır; pending profil varsa aktiv edilir.
 */
export async function setPasswordWithAccessToken(accessToken, password) {
  const plain = String(password ?? "").trim()
  if (!plain || plain.length < 8) {
    throw new AppError("Şifrə ən azı 8 simvol olmalıdır", 400)
  }

  const { data: { user }, error } = await supabase.auth.getUser(accessToken)
  if (error || !user) {
    throw new AppError("Yanlış və ya bitmiş token", 401)
  }

  const admin = getSupabaseAdmin()
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: plain,
  })

  if (updateError) {
    throw new AppError(updateError.message || "Şifrə təyin edilə bilmədi", 400)
  }

  try {
    const { data: row } = await admin
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle()
    if (row?.status === "pending") {
      await admin.from("profiles").update({ status: "active" }).eq("id", user.id)
    }
  } catch {
    // şifrə artıq təyin olunub
  }

  return { user: toPublicUser(updated?.user ?? user) }
}
