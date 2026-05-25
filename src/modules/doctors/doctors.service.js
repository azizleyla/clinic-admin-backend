import { AppError } from "../../common/AppError.js";
import getSupabaseAdmin from "../../config/supabaseAdmin.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export const DOCTOR_STATUSES = ["active", "on_leave", "inactive"];
const PUBLIC_VISIBLE_STATUSES = ["active", "on_leave"];

function parsePositiveInt(value, fallback) {
  const n = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function parseStatusFilter(rawStatus) {
  const raw = String(rawStatus ?? "").trim().toLowerCase();

  if (!raw) return PUBLIC_VISIBLE_STATUSES;
  if (raw === "all") return null;

  const valid = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => DOCTOR_STATUSES.includes(s));

  return valid.length > 0 ? valid : PUBLIC_VISIBLE_STATUSES;
}

export function parseDoctorsListQuery(query = {}) {
  const statuses = parseStatusFilter(query.status);

  const hasPage = query.page != null && String(query.page).trim() !== "";
  const hasLimit = query.limit != null && String(query.limit).trim() !== "";

  if (!hasPage && !hasLimit) {
    return { paginate: false, statuses };
  }

  const limit = Math.min(
    parsePositiveInt(query.limit, DEFAULT_LIMIT),
    MAX_LIMIT,
  );
  const page = hasPage
    ? parsePositiveInt(query.page, DEFAULT_PAGE)
    : DEFAULT_PAGE;

  return { paginate: true, page, limit, statuses };
}

/**
 * Doctors siyahısı — `departments` ilə nested join.
 * Cavabda hər həkim üçün düz `department` (ad) sahəsi olacaq.
 */
export async function getDoctorsService({
  page,
  limit,
  paginate,
  statuses,
} = {}) {
  const supabaseAdmin = getSupabaseAdmin();

  let q = supabaseAdmin
    .from("doctors")
    .select("*, departments(id, title)", {
      count: paginate ? "exact" : undefined,
    })
    .order("created_at", { ascending: false });

  if (Array.isArray(statuses) && statuses.length > 0) {
    q = q.in("status", statuses);
  }

  if (paginate) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    q = q.range(from, to);
  }

  const { data: doctors, error, count } = await q;

  if (error) {
    throw new AppError(error.message || "Həkim siyahısı alına bilmədi", 500);
  }

  const items = (doctors ?? []).map((doctor) => {
    const { departments, ...rest } = doctor;

    return {
      ...rest,
      department: departments?.title ?? null,
    };
  });

  const totalElements = paginate ? (count ?? 0) : items.length;

  if (!paginate) {
    return {
      items,
      fields: { totalElements },
    };
  }

  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / limit);

  return {
    items,
    currentPage: page,
    totalElements,
    totalPages,
    hasNextPage: page < totalPages,
  };
}

/**
 * Həkimin statusunu dəyişir (active | on_leave | inactive).
 */
export async function updateDoctorStatusService(id, status) {
  const doctorId = Number(id);
  if (!Number.isFinite(doctorId) || doctorId < 1) {
    throw new AppError("Həkim id düzgün deyil", 400);
  }

  const nextStatus = String(status ?? "")
    .trim()
    .toLowerCase();
  if (!DOCTOR_STATUSES.includes(nextStatus)) {
    throw new AppError(
      `Status düzgün deyil. İcazəli dəyərlər: ${DOCTOR_STATUSES.join(", ")}`,
      400,
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("doctors")
    .select("id, status")
    .eq("id", doctorId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError(fetchError.message || "Həkim tapıla bilmədi", 500);
  }
  if (!existing) {
    throw new AppError("Həkim tapılmadı", 404);
  }

  if (existing.status === nextStatus) {
    return existing;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("doctors")
    .update({ status: nextStatus })
    .eq("id", doctorId)
    .select("id, status")
    .single();

  if (error) {
    throw new AppError(error.message || "Status yenilənə bilmədi", 500);
  }

  return updated;
}
