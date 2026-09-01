import { AppError } from "../../common/AppError.js";
import getSupabaseAdmin from "../../config/supabaseAdmin.js";
import {
  DEFAULT_DEPARTMENT_ICON,
  isValidDepartmentIcon,
} from "./departments.constants.js";

export async function getDepartmentsService() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: departments, error } = await supabaseAdmin
    .from("departments")
    .select("*")
    .order("id", { ascending: true });
  if (error) {
    throw new AppError(error.message || "Şöbə siyahısı alına bilmədi", 500);
  }
  return departments ?? [];
}

export async function getDepartmentByIdService(id) {
  const departmentId = Number(id);
  if (!Number.isFinite(departmentId) || departmentId < 1) {
    throw new AppError("Şöbə id düzgün deyil", 400);
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: department, error } = await supabaseAdmin
    .from("departments")
    .select("*")
    .eq("id", departmentId)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message || "Şöbə tapıla bilmədi", 500);
  }
  if (!department) {
    throw new AppError("Şöbə tapılmadı", 404);
  }

  return department;
}

/* ----------------------------- köməkçilər ----------------------------- */

/** Postman/JSON-dan gələn lokalizə olunmuş sahə string ola bilər; JSON-a çevir. */
function parseMaybeJson(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return value;
  const clean = value.trim();
  if (!clean) return null;
  try {
    return JSON.parse(clean);
  } catch {
    return value;
  }
}

function normalizeIcon(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_DEPARTMENT_ICON;
  if (!isValidDepartmentIcon(raw)) {
    throw new AppError(`İkon açarı düzgün deyil: "${raw}"`, 400);
  }
  return raw;
}

function getFileExtension(fileName, mimeType) {
  const name = String(fileName ?? "");
  const fromName = name.includes(".")
    ? name.split(".").pop()?.toLowerCase()
    : "";
  if (fromName) return fromName;
  const mime = String(mimeType ?? "").toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

function getDepartmentsBucketName() {
  return process.env.SUPABASE_DEPARTMENTS_BUCKET?.trim() || "assets";
}

function getDepartmentsStoragePrefix() {
  if (process.env.SUPABASE_DEPARTMENTS_STORAGE_PREFIX !== undefined) {
    return String(process.env.SUPABASE_DEPARTMENTS_STORAGE_PREFIX)
      .trim()
      .replace(/^\/+|\/+$/g, "");
  }
  return "departments";
}

function extractStoragePathFromPublicUrl(publicUrl, bucketName) {
  const url = String(publicUrl ?? "").trim();
  if (!url) return null;
  const marker = `/object/public/${bucketName}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;
  const path = url.slice(markerIndex + marker.length);
  return path ? decodeURIComponent(path) : null;
}

async function uploadDepartmentImage(supabaseAdmin, imageFile) {
  if (!imageFile?.buffer?.length) return null;
  if (!String(imageFile.mimetype).startsWith("image/")) {
    throw new AppError("Yalnız şəkil faylı qəbul olunur", 400);
  }

  const bucketName = getDepartmentsBucketName();
  const pathPrefix = getDepartmentsStoragePrefix();
  const ext = getFileExtension(imageFile.originalname, imageFile.mimetype);
  const fileName = `department-${Date.now()}.${ext}`;
  const filePath = pathPrefix ? `${pathPrefix}/${fileName}` : fileName;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, imageFile.buffer, {
      contentType: imageFile.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new AppError(uploadError.message || "Şəkil storage-ə yüklənmədi", 500);
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath);
  return publicUrl;
}

/** desc/content DB-də düz text sütunlarıdır → string kimi saxla (JSON-a çevirmə). */
function toPlainText(value) {
  if (value == null) return null;
  const str = String(value);
  return str.trim() === "" ? null : str;
}

function buildDepartmentPayload({ title, desc, content, icon_name }) {
  const parsedTitle = parseMaybeJson(title);
  if (!parsedTitle) {
    throw new AppError("Başlıq (title) tələb olunur", 400);
  }

  return {
    title: parsedTitle,
    desc: toPlainText(desc),
    content: toPlainText(content),
    icon_name: normalizeIcon(icon_name),
  };
}

/* ------------------------------- CRUD ------------------------------- */

export async function createDepartmentService({
  title,
  desc,
  content,
  icon_name,
  imageFile,
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const payload = buildDepartmentPayload({ title, desc, content, icon_name });

  const imgUrl = await uploadDepartmentImage(supabaseAdmin, imageFile);
  if (imgUrl) {
    payload.img_url = imgUrl;
  }

  const { data: created, error } = await supabaseAdmin
    .from("departments")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message || "Şöbə yaradıla bilmədi", 500);
  }

  return created;
}

export async function editDepartmentService(
  id,
  { title, desc, content, icon_name, imageFile },
) {
  const supabaseAdmin = getSupabaseAdmin();
  const departmentId = Number(id);
  if (!Number.isFinite(departmentId) || departmentId < 1) {
    throw new AppError("Şöbə id düzgün deyil", 400);
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("departments")
    .select("*")
    .eq("id", departmentId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError(fetchError.message || "Şöbə tapıla bilmədi", 500);
  }
  if (!existing) {
    throw new AppError("Şöbə tapılmadı", 404);
  }

  const payload = buildDepartmentPayload({ title, desc, content, icon_name });

  const imgUrl = await uploadDepartmentImage(supabaseAdmin, imageFile);
  if (imgUrl) {
    payload.img_url = imgUrl;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("departments")
    .update(payload)
    .eq("id", departmentId)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message || "Şöbə yenilənə bilmədi", 500);
  }

  return updated;
}

export async function deleteDepartmentService(id) {
  const supabaseAdmin = getSupabaseAdmin();
  const departmentId = Number(id);
  if (!Number.isFinite(departmentId) || departmentId < 1) {
    throw new AppError("Şöbə id düzgün deyil", 400);
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("departments")
    .select("id, img_url")
    .eq("id", departmentId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError(fetchError.message || "Şöbə tapıla bilmədi", 500);
  }
  if (!existing) {
    throw new AppError("Şöbə tapılmadı", 404);
  }

  const bucketName = getDepartmentsBucketName();
  const storagePath = extractStoragePathFromPublicUrl(
    existing.img_url,
    bucketName,
  );
  if (storagePath) {
    const { error: storageError } = await supabaseAdmin.storage
      .from(bucketName)
      .remove([storagePath]);
    if (storageError) {
      throw new AppError(
        storageError.message || "Şəkil storage-dən silinə bilmədi",
        500,
      );
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("departments")
    .delete()
    .eq("id", departmentId);

  if (deleteError) {
    throw new AppError(deleteError.message || "Şöbə silinə bilmədi", 500);
  }

  return { deletedId: departmentId };
}
