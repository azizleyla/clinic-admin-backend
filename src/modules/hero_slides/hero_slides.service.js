import { AppError } from "../../common/AppError.js";
import getSupabaseAdmin from "../../config/supabaseAdmin.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBoolean(value) {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return null;
}

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

function assertUuid(id, label = "Slider id") {
  const value = String(id ?? "").trim();
  if (!UUID_REGEX.test(value)) {
    throw new AppError(`${label} düzgün deyil`, 400);
  }
  return value;
}

function getSlidersBucketName() {
  return process.env.SUPABASE_SLIDERS_BUCKET?.trim() || "assets";
}

function getSlidersStoragePrefix() {
  if (process.env.SUPABASE_SLIDERS_STORAGE_PREFIX !== undefined) {
    return String(process.env.SUPABASE_SLIDERS_STORAGE_PREFIX)
      .trim()
      .replace(/^\/+|\/+$/g, "");
  }
  return "sliders";
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
  if (mime === "image/svg+xml") return "svg";
  return "jpg";
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

function resolveImagePayload(
  imageFile,
  imageBuffer,
  imageMime,
  imageOriginalName,
) {
  if (imageFile?.buffer) {
    return {
      buffer: imageFile.buffer,
      mimetype: imageFile.mimetype,
      originalname: imageFile.originalname,
    };
  }
  if (imageBuffer && imageMime) {
    return {
      buffer: imageBuffer,
      mimetype: String(imageMime),
      originalname: imageOriginalName
        ? String(imageOriginalName)
        : "upload.jpg",
    };
  }
  return null;
}

async function uploadSliderImage(supabaseAdmin, resolvedImage) {
  if (!String(resolvedImage.mimetype).startsWith("image/")) {
    throw new AppError("Yalnız şəkil faylı qəbul olunur", 400);
  }

  const bucketName = getSlidersBucketName();
  const pathPrefix = getSlidersStoragePrefix();
  const ext = getFileExtension(
    resolvedImage.originalname,
    resolvedImage.mimetype,
  );
  const fileName = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = pathPrefix ? `${pathPrefix}/${fileName}` : fileName;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, resolvedImage.buffer, {
      contentType: resolvedImage.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new AppError(
      uploadError.message || "Şəkil storage-ə yüklənmədi",
      500,
    );
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath);

  return publicUrl;
}

async function removeSliderImage(supabaseAdmin, imageUrl) {
  const bucketName = getSlidersBucketName();
  const storagePath = extractStoragePathFromPublicUrl(imageUrl, bucketName);
  if (!storagePath) return;

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

export async function getHeroSlidesService({ is_active } = {}) {
  const supabaseAdmin = getSupabaseAdmin();
  const isActive = parseBoolean(is_active);

  let q = supabaseAdmin
    .from("hero_slides")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });

  if (isActive !== null) {
    q = q.eq("is_active", isActive);
  }

  const { data: slides, error } = await q;

  if (error) {
    throw new AppError(error.message || "Slider siyahısı alına bilmədi", 500);
  }

  return slides ?? [];
}

export async function getHeroSlideByIdService(id) {
  const slideId = assertUuid(id);
  const supabaseAdmin = getSupabaseAdmin();

  const { data: slide, error } = await supabaseAdmin
    .from("hero_slides")
    .select("*")
    .eq("id", slideId)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message || "Slider tapıla bilmədi", 500);
  }
  if (!slide) {
    throw new AppError("Slider tapılmadı", 404);
  }

  return slide;
}

export async function createHeroSlideService({
  title,
  description,
  is_active,
  imageFile,
  imageBuffer,
  imageMime,
  imageOriginalName,
}) {
  const supabaseAdmin = getSupabaseAdmin();

  const resolvedImage = resolveImagePayload(
    imageFile,
    imageBuffer,
    imageMime,
    imageOriginalName,
  );
  if (!resolvedImage?.buffer?.length) {
    throw new AppError(
      "Şəkil tələb olunur (multipart file və ya JSON-da image_base64)",
      400,
    );
  }

  const publicUrl = await uploadSliderImage(supabaseAdmin, resolvedImage);

  const parsedIsActive = parseBoolean(is_active);
  const payload = {
    title: parseMaybeJson(title),
    description: parseMaybeJson(description),
    image_url: publicUrl,
    is_active: parsedIsActive === null ? true : parsedIsActive,
  };

  const { data: created, error } = await supabaseAdmin
    .from("hero_slides")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    await removeSliderImage(supabaseAdmin, publicUrl).catch(() => {});
    throw new AppError(error.message || "Slider yaradıla bilmədi", 500);
  }

  return created;
}

export async function editHeroSlideService(
  id,
  {
    title,
    description,
    is_active,
    imageFile,
    imageBuffer,
    imageMime,
    imageOriginalName,
  },
) {
  const slideId = assertUuid(id);
  const supabaseAdmin = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("hero_slides")
    .select("*")
    .eq("id", slideId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError(fetchError.message || "Slider tapıla bilmədi", 500);
  }
  if (!existing) {
    throw new AppError("Slider tapılmadı", 404);
  }

  let imageUrl = existing.image_url;
  const resolvedImage = resolveImagePayload(
    imageFile,
    imageBuffer,
    imageMime,
    imageOriginalName,
  );

  if (resolvedImage?.buffer?.length) {
    imageUrl = await uploadSliderImage(supabaseAdmin, resolvedImage);
  }

  const parsedIsActive = parseBoolean(is_active);
  const payload = {
    title: title !== undefined ? parseMaybeJson(title) : existing.title,
    description:
      description !== undefined
        ? parseMaybeJson(description)
        : existing.description,
    image_url: imageUrl,
    is_active:
      parsedIsActive === null ? existing.is_active : parsedIsActive,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await supabaseAdmin
    .from("hero_slides")
    .update(payload)
    .eq("id", slideId)
    .select("*")
    .single();

  if (error) {
    if (resolvedImage?.buffer?.length) {
      await removeSliderImage(supabaseAdmin, imageUrl).catch(() => {});
    }
    throw new AppError(error.message || "Slider yenilənə bilmədi", 500);
  }

  if (
    resolvedImage?.buffer?.length &&
    existing.image_url &&
    existing.image_url !== imageUrl
  ) {
    await removeSliderImage(supabaseAdmin, existing.image_url).catch(() => {});
  }

  return updated;
}

export async function deleteHeroSlideService(id) {
  const slideId = assertUuid(id);
  const supabaseAdmin = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("hero_slides")
    .select("id, image_url")
    .eq("id", slideId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError(fetchError.message || "Slider tapıla bilmədi", 500);
  }
  if (!existing) {
    throw new AppError("Slider tapılmadı", 404);
  }

  if (existing.image_url) {
    await removeSliderImage(supabaseAdmin, existing.image_url);
  }

  const { error: deleteError } = await supabaseAdmin
    .from("hero_slides")
    .delete()
    .eq("id", slideId);

  if (deleteError) {
    throw new AppError(deleteError.message || "Slider silinə bilmədi", 500);
  }

  return { deletedId: slideId };
}

/**
 * Sliderləri yenidən sırala.
 * items: [{ id: uuid, order_index: number }, ...]
 */
export async function reorderHeroSlidesService(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("items array tələb olunur", 400);
  }

  const normalized = items.map((item, idx) => {
    if (!item || typeof item !== "object") {
      throw new AppError(`items[${idx}] obyekt olmalıdır`, 400);
    }
    const id = assertUuid(item.id, `items[${idx}].id`);
    const orderIndex = Number(item.order_index);
    if (!Number.isFinite(orderIndex) || orderIndex < 0) {
      throw new AppError(
        `items[${idx}].order_index müsbət rəqəm olmalıdır`,
        400,
      );
    }
    return { id, order_index: orderIndex };
  });

  const ids = normalized.map((i) => i.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw new AppError("items arrayda təkrarlanan id var", 400);
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("hero_slides")
    .select("id")
    .in("id", ids);

  if (fetchError) {
    throw new AppError(fetchError.message || "Sliderlər tapıla bilmədi", 500);
  }

  const existingIds = new Set((existing ?? []).map((s) => s.id));
  const missing = ids.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    throw new AppError(
      `Bu id-lər tapılmadı: ${missing.join(", ")}`,
      404,
    );
  }

  const nowIso = new Date().toISOString();
  const results = await Promise.all(
    normalized.map(({ id, order_index }) =>
      supabaseAdmin
        .from("hero_slides")
        .update({ order_index, updated_at: nowIso })
        .eq("id", id),
    ),
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    throw new AppError(
      failed.error.message || "Sıralama yenilənə bilmədi",
      500,
    );
  }

  return { updatedCount: normalized.length };
}
