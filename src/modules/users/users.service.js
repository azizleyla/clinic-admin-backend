import { AppError } from "../../common/AppError.js"
import getSupabaseAdmin from "../../config/supabaseAdmin.js"
import { toPublicUser } from "../auth/auth.service.js"

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase()
}

function normalizeStatus(status) {
  return String(status ?? "").trim().toLowerCase()
}

/**
 * Admin: Supabase auth-da user + profiles cədvəli.
 * password verilməzsə invite email göndərilir ki user şifrəsini özü təyin etsin.
 * SUPABASE_INVITE_REDIRECT_TO — dəvət linkindən sonra açılacaq tam URL (məs. …/auth/set-password).
 * Əks halda Supabase Site URL (/) istifadə olunur və React /login-ə yönləndirir.
 */
export async function createUserAsAdmin({ email, full_name, role, password }) {
  const supabaseAdmin = getSupabaseAdmin()

  const cleanEmail = normalizeEmail(email)
  const name = String(full_name ?? "").trim()
  const roleValue = String(role ?? "").trim()

  if (!cleanEmail) {
    throw new AppError("Email tələb olunur", 400)
  }
  if (!name) {
    throw new AppError("Ad və soyad tələb olunur", 400)
  }
  if (!roleValue) {
    throw new AppError("Rol tələb olunur", 400)
  }

  const plainPassword = password != null && String(password).length > 0 ? String(password) : null
  const shouldSendInvite = !plainPassword
  if (plainPassword && plainPassword.length < 8) {
    throw new AppError("Şifrə ən azı 8 simvol olmalıdır", 400)
  }

  let created = null
  let createError = null

  if (shouldSendInvite) {
    const redirectTo = process.env.SUPABASE_INVITE_REDIRECT_TO?.trim()
    const inviteOpts = { data: { full_name: name } }
    if (redirectTo) {
      inviteOpts.redirectTo = redirectTo
    }
    const result = await supabaseAdmin.auth.admin.inviteUserByEmail(
      cleanEmail,
      inviteOpts
    )
    created = result.data
    createError = result.error
  } else {
    const result = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: plainPassword,
      email_confirm: true,
      user_metadata: { full_name: name },
    })
    created = result.data
    createError = result.error
  }

  if (createError || !created?.user) {
    const msg =
      createError?.message?.includes("already been registered") ||
        createError?.message?.includes("already registered")
        ? "Bu email artıq qeydiyyatdan keçib"
        : createError?.message || "İstifadəçi yaradıla bilmədi"
    throw new AppError(msg, 400)
  }

  const userId = created.user.id

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: userId, full_name: name, role: roleValue, status: "pending" },
      { onConflict: "id" }
    )
    .select()
    .single()

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw new AppError("Profil saxlanıla bilmədi", 500)
  }

  const result = {
    user: toPublicUser(created.user),
    profile,
    invitationSent: shouldSendInvite,
  }
  return result
}

/**
 * Admin mövcud istifadəçini redaktə edir.
 * Dəyişən sahələr: full_name, role, status, email.
 */
export async function editUserAsAdmin({
  actorUserId,
  targetUserId,
  email,
  full_name,
  role,
  status,
}) {
  const actor = String(actorUserId ?? "").trim()
  const target = String(targetUserId ?? "").trim()
  if (!target) {
    throw new AppError("İstifadəçi id tələb olunur", 400)
  }
  if (actor === target) {
    throw new AppError("Öz hesabınızı redaktə edə bilməzsiniz", 403)
  }

  const name = full_name != null ? String(full_name).trim() : undefined
  const roleValue = role != null ? String(role).trim() : undefined
  const statusValue = status != null ? normalizeStatus(status) : undefined
  const cleanEmail = email != null ? normalizeEmail(email) : undefined

  if (name !== undefined && !name) {
    throw new AppError("Ad və soyad boş ola bilməz", 400)
  }
  if (roleValue !== undefined && !roleValue) {
    throw new AppError("Rol boş ola bilməz", 400)
  }
  if (cleanEmail !== undefined && !cleanEmail) {
    throw new AppError("Email boş ola bilməz", 400)
  }

  const allowedStatuses = new Set(["active", "inactive", "blocked", "pending"])
  if (statusValue !== undefined && !allowedStatuses.has(statusValue)) {
    throw new AppError("Status dəyəri yanlışdır", 400)
  }

  if (
    name === undefined &&
    roleValue === undefined &&
    statusValue === undefined &&
    cleanEmail === undefined
  ) {
    throw new AppError("Yenilənəcək sahə göndərin", 400)
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(target)
  if (authErr || !authData?.user) {
    throw new AppError("İstifadəçi tapılmadı", 404)
  }

  let nextAuthUser = authData.user
  if (cleanEmail !== undefined || name !== undefined) {
    const authUpdatePayload = {}
    if (cleanEmail !== undefined) authUpdatePayload.email = cleanEmail
    if (name !== undefined) {
      authUpdatePayload.user_metadata = {
        ...(authData.user.user_metadata ?? {}),
        full_name: name,
      }
    }

    const { data: updatedAuth, error: authUpdateErr } =
      await supabaseAdmin.auth.admin.updateUserById(target, authUpdatePayload)
    if (authUpdateErr || !updatedAuth?.user) {
      throw new AppError(authUpdateErr?.message || "Auth məlumatı yenilənmədi", 400)
    }
    nextAuthUser = updatedAuth.user
  }

  const profileUpdate = {}
  if (name !== undefined) profileUpdate.full_name = name
  if (roleValue !== undefined) profileUpdate.role = roleValue
  if (statusValue !== undefined) profileUpdate.status = statusValue

  let profile = null
  if (Object.keys(profileUpdate).length > 0) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", target)
      .select("*")
      .maybeSingle()

    if (error || !data) {
      throw new AppError("Profil yenilənmədi", 400)
    }
    profile = data
  } else {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", target)
      .maybeSingle()
    if (error || !data) {
      throw new AppError("İstifadəçi tapılmadı", 404)
    }
    profile = data
  }

  return {
    user: toPublicUser(nextAuthUser),
    profile,
  }
}



/**
 * Admin pending istifadəçiyə dəvət mailini yenidən göndərir.
 */
export async function resendInviteAsAdmin({ targetUserId }) {
  const target = String(targetUserId ?? "").trim()
  if (!target) {
    throw new AppError("İstifadəçi id tələb olunur", 400)
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(target)
  const authUser = authData?.user
  if (authErr || !authUser) {
    throw new AppError("İstifadəçi tapılmadı", 404)
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("status, full_name")
    .eq("id", target)
    .maybeSingle()

  if (profileErr || !profile) {
    throw new AppError("İstifadəçi tapılmadı", 404)
  }
  if (String(profile.status ?? "").toLowerCase() !== "pending") {
    throw new AppError("Yalnız pending istifadəçilərə dəvət yenidən göndərilir", 400)
  }

  const email = normalizeEmail(authUser.email)
  if (!email) {
    throw new AppError("İstifadəçi email-i tapılmadı", 400)
  }

  const redirectTo = process.env.SUPABASE_INVITE_REDIRECT_TO?.trim()
  const inviteOpts = { data: { full_name: profile.full_name ?? null } }
  if (redirectTo) {
    inviteOpts.redirectTo = redirectTo
  }

  const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, inviteOpts)
  if (inviteErr) {
    throw new AppError(inviteErr.message || "Dəvət maili göndərilə bilmədi", 400)
  }

  return { id: target, email, invitationSent: true }
}


export async function getUsersService() {
  const supabaseAdmin = getSupabaseAdmin()

  // auth users
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.listUsers()

  if (authError) throw authError

  // profiles
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, status")

  if (profileError) throw profileError

  // map profiles by id
  const profileMap = new Map(
    profiles.map((p) => [p.id, p])
  )

  // merge
  const users = authData.users.map((user) => {
    const profile = profileMap.get(user.id)

    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || null,
      role: profile?.role || null,
      status: profile?.status || null,
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at
    }
  })

  return users
}

/**
 * Admin başqa istifadəçini tam silir.
 *
 * Nə silinir:
 * 1) `profiles` sətri — əvvəl silinir ki, auth.users-a bağlı FK (əksər sxemələrdə profiles.id → auth.users)
 *    RESTRICT olsa belə, əvvəl profil getməlidir.
 * 2) Supabase Auth istifadəçisi — `auth.admin.deleteUser` sessiyanı, girişi ləğv edir.
 *
 * Təhlükəsizlik: admin öz hesabını silə bilməz (UI-da düymə gizlətmək kifayət deyil, serverdə yoxlanır).
 *
 * Yanlış id formatı və ya bazada yoxluq: formatı əvvəlcə yoxlamırıq; Supabase xətası olsa belə
 * client-ə yalnız «İstifadəçi tapılmadı» (404) — SDK texniki mətni göstərilmir.
 */
export async function deleteUserAsAdmin({ actorUserId, targetUserId }) {
  const actor = String(actorUserId ?? "").trim()
  const target = String(targetUserId ?? "").trim()

  if (!target) {
    throw new AppError("İstifadəçi id tələb olunur", 400)
  }
  if (actor === target) {
    throw new AppError("Öz hesabınızı silə bilməzsiniz", 403)
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(target)
  if (error || !data?.user) {
    throw new AppError("İstifadəçi tapılmadı", 404)
  }

  const { error: profileDelErr } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", target)
  if (profileDelErr) {
    throw new AppError("İstifadəçi tapılmadı", 404)
  }

  const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(target)
  if (authDelErr) {
    throw new AppError("İstifadəçi tapılmadı", 404)
  }

  return { deletedId: target }
}

/**
 * Admin istifadəçini bloklayır (profiles.status = blocked).
 * Qeyd: bu mərhələdə Auth user silinmir; sadəcə status dəyişir.
 */
export async function blockUserAsAdmin({ actorUserId, targetUserId }) {
  return changeUserStatusAsAdmin({
    actorUserId,
    targetUserId,
    status: "blocked",
  })
}

/**
 * Admin istifadəçinin blokunu açır (profiles.status = active).
 */
export async function unblockUserAsAdmin({ actorUserId, targetUserId }) {
  return changeUserStatusAsAdmin({
    actorUserId,
    targetUserId,
    status: "active",
  })
}

/**
 * Frontend axınına uyğun status yeniləmə:
 * PATCH /users/status/:id  body: { status: "active" | "inactive" | "blocked" }
 */
export async function changeUserStatusAsAdmin({ actorUserId, targetUserId, status }) {
  const actor = String(actorUserId ?? "").trim()
  const target = String(targetUserId ?? "").trim()
  const nextStatus = normalizeStatus(status)
  const allowed = new Set(["active", "inactive", "blocked"])

  if (!target) {
    throw new AppError("İstifadəçi id tələb olunur", 400)
  }
  if (!allowed.has(nextStatus)) {
    throw new AppError("Status dəyəri yanlışdır", 400)
  }
  if (actor === target) {
    throw new AppError("Öz hesabınızın statusunu dəyişə bilməzsiniz", 403)
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(target)
  if (error || !data?.user) {
    throw new AppError("İstifadəçi tapılmadı", 404)
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update({ status: nextStatus })
    .eq("id", target)
    .select("id, status")
    .maybeSingle()

  if (profileErr || !profile) {
    throw new AppError("İstifadəçi tapılmadı", 404)
  }

  return { id: target, status: nextStatus }
}