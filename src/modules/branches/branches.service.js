import { AppError } from "../../common/AppError.js";
import getSupabaseAdmin from "../../config/supabaseAdmin.js";

export async function getBranchesService() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: branches, error } = await supabaseAdmin
    .from("branches")
    .select("*");

  if (error) {
    throw new AppError(error.message || "Filial siyahısı alına bilmədi", 500);
  }

  return branches ?? [];
}

export async function getBranchByIdService(id) {
  const branchId = Number(id);
  if (!Number.isFinite(branchId) || branchId < 1) {
    throw new AppError("Filial id düzgün deyil", 400);
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: branch, error } = await supabaseAdmin
    .from("branches")
    .select("*")
    .eq("id", branchId)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message || "Filial tapıla bilmədi", 500);
  }
  if (!branch) {
    throw new AppError("Filial tapılmadı", 404);
  }

  return branch;
}
