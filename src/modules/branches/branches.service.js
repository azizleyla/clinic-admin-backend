import { AppError } from "../../common/AppError.js";
import getSupabaseAdmin from "../../config/supabaseAdmin.js";

export async function getBranchesService(clinicId) {
  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin.from("branches").select("*");
  if (clinicId) query = query.eq("clinic_id", clinicId);
  const { data: branches, error } = await query;

  if (error) {
    throw new AppError(error.message || "Filial siyahısı alına bilmədi", 500);
  }

  return branches ?? [];
}

export async function getBranchByIdService(id, clinicId) {
  const branchId = Number(id);
  if (!Number.isFinite(branchId) || branchId < 1) {
    throw new AppError("Filial id düzgün deyil", 400);
  }

  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from("branches")
    .select("*")
    .eq("id", branchId);
  if (clinicId) query = query.eq("clinic_id", clinicId);
  const { data: branch, error } = await query.maybeSingle();

  if (error) {
    throw new AppError(error.message || "Filial tapıla bilmədi", 500);
  }
  if (!branch) {
    throw new AppError("Filial tapılmadı", 404);
  }

  return branch;
}
