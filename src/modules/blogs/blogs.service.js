import { AppError } from "../../common/AppError.js";
import getSupabaseAdmin from "../../config/supabaseAdmin.js";

export async function getBlogsService() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: blogs, error } = await supabaseAdmin.from("blogs").select("*");
  if (error) {
    throw new AppError(error.message || "Bloq siyahısı alına bilmədi", 500);
  }
  return blogs ?? [];
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

function generateSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUniqueSlug(supabaseAdmin, baseSlug, excludeId = null) {
  let nextSlug = baseSlug;
  let index = 1;
  while (true) {
    let query = supabaseAdmin.from("blogs").select("id").eq("slug", nextSlug);
    if (excludeId != null) {
      query = query.neq("id", excludeId);
    }
    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new AppError(error.message || "Slug yoxlanıla bilmədi", 500);
    }
    if (!data) {
      return nextSlug;
    }
    index += 1;
    nextSlug = `${baseSlug}-${index}`;
  }
}

function getFileExtension(fileName, mimeType) {
  const name = String(fileName ?? "");
  const fromName = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  if (fromName) return fromName;

  const mime = String(mimeType ?? "").toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

function getBlogsBucketName() {
  return process.env.SUPABASE_BLOGS_BUCKET?.trim() || "assets";
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

function resolveImagePayload(imageFile, imageBuffer, imageMime, imageOriginalName) {
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
      originalname: imageOriginalName ? String(imageOriginalName) : "upload.jpg",
    };
  }
  return null;
}

export async function createBlogService({
  title,
  slug: slugInput,
  content,
  excerpt,
  category_id,
  tags,
  published_at,
  imageFile,
  imageBuffer,
  imageMime,
  imageOriginalName,
}) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!title) {
    throw new AppError("Başlıq (title) tələb olunur", 400);
  }
  const resolvedImage = resolveImagePayload(imageFile, imageBuffer, imageMime, imageOriginalName);
  if (!resolvedImage?.buffer?.length) {
    throw new AppError("Şəkil tələb olunur (multipart file və ya JSON-da image_base64)", 400);
  }
  if (!String(resolvedImage.mimetype).startsWith("image/")) {
    throw new AppError("Yalnız şəkil faylı qəbul olunur", 400);
  }

  const parsedTitle = parseMaybeJson(title);
  const parsedContent = parseMaybeJson(content);
  const parsedExcerpt = parseMaybeJson(excerpt);
  const parsedTags = parseMaybeJson(tags);

  const parsedSlug = parseMaybeJson(slugInput);
  const titleForFallback =
    typeof parsedTitle === "string" ? parsedTitle : parsedTitle?.az ?? parsedTitle?.en ?? "";
  const slugBase = generateSlug(parsedSlug || titleForFallback);
  if (!slugBase) {
    throw new AppError("Slug tələb olunur və ya title-dan yaradıla bilməlidir", 400);
  }
  const uniqueSlug = await ensureUniqueSlug(supabaseAdmin, slugBase);

  const bucketName = getBlogsBucketName();
  let pathPrefix = "blogs";
  if (process.env.SUPABASE_BLOGS_STORAGE_PREFIX !== undefined) {
    pathPrefix = String(process.env.SUPABASE_BLOGS_STORAGE_PREFIX)
      .trim()
      .replace(/^\/+|\/+$/g, "");
  }
  const ext = getFileExtension(resolvedImage.originalname, resolvedImage.mimetype);
  const fileName = `${uniqueSlug}-${Date.now()}.${ext}`;
  const filePath = pathPrefix ? `${pathPrefix}/${fileName}` : fileName;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, resolvedImage.buffer, {
      contentType: resolvedImage.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new AppError(uploadError.message || "Şəkil storage-ə yüklənmədi", 500);
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath);

  const payload = {
    title: parsedTitle,
    content: parsedContent,
    excerpt: parsedExcerpt,
    tags: parsedTags,
    slug: uniqueSlug,
    img_url: publicUrl,
    category_id: category_id != null && String(category_id).trim() !== "" ? Number(category_id) : null,
    published_at: published_at ? new Date(published_at).toISOString() : null,
  };

  const { data: created, error } = await supabaseAdmin
    .from("blogs")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message || "Bloq yaradıla bilmədi", 500);
  }

  return created;
}

export async function editBlogService(
  id,
  {
    title,
    slug: slugInput,
    content,
    excerpt,
    category_id,
    tags,
    published_at,
    imageFile,
    imageBuffer,
    imageMime,
    imageOriginalName,
  },
) {
  const supabaseAdmin = getSupabaseAdmin();
  const blogId = Number(id);
  if (!Number.isFinite(blogId)) {
    throw new AppError("Blog id düzgün deyil", 400);
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("blogs")
    .select("*")
    .eq("id", blogId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError(fetchError.message || "Bloq tapıla bilmədi", 500);
  }
  if (!existing) {
    throw new AppError("Bloq tapılmadı", 404);
  }

  if (!title) {
    throw new AppError("Başlıq (title) tələb olunur", 400);
  }

  const parsedTitle = parseMaybeJson(title);
  const parsedContent = parseMaybeJson(content);
  const parsedExcerpt = parseMaybeJson(excerpt);
  const parsedTags = parseMaybeJson(tags);

  const parsedSlug = parseMaybeJson(slugInput);
  const titleForFallback =
    typeof parsedTitle === "string" ? parsedTitle : parsedTitle?.az ?? parsedTitle?.en ?? "";
  const slugBase = generateSlug(parsedSlug || titleForFallback);
  if (!slugBase) {
    throw new AppError("Slug tələb olunur və ya title-dan yaradıla bilməlidir", 400);
  }
  const uniqueSlug = await ensureUniqueSlug(supabaseAdmin, slugBase, blogId);

  let imgUrl = existing.img_url;
  const resolvedImage = resolveImagePayload(imageFile, imageBuffer, imageMime, imageOriginalName);

  if (resolvedImage?.buffer?.length) {
    if (!String(resolvedImage.mimetype).startsWith("image/")) {
      throw new AppError("Yalnız şəkil faylı qəbul olunur", 400);
    }

    const bucketName = getBlogsBucketName();
    let pathPrefix = "blogs";
    if (process.env.SUPABASE_BLOGS_STORAGE_PREFIX !== undefined) {
      pathPrefix = String(process.env.SUPABASE_BLOGS_STORAGE_PREFIX)
        .trim()
        .replace(/^\/+|\/+$/g, "");
    }
    const ext = getFileExtension(resolvedImage.originalname, resolvedImage.mimetype);
    const fileName = `${uniqueSlug}-${Date.now()}.${ext}`;
    const filePath = pathPrefix ? `${pathPrefix}/${fileName}` : fileName;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, resolvedImage.buffer, {
        contentType: resolvedImage.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new AppError(uploadError.message || "Şəkil storage-ə yüklənmədi", 500);
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath);
    imgUrl = publicUrl;
  }

  const payload = {
    title: parsedTitle,
    content: parsedContent,
    excerpt: parsedExcerpt,
    tags: parsedTags,
    slug: uniqueSlug,
    img_url: imgUrl,
    category_id:
      category_id != null && String(category_id).trim() !== "" ? Number(category_id) : null,
    published_at: published_at ? new Date(published_at).toISOString() : null,
  };

  const { data: updated, error } = await supabaseAdmin
    .from("blogs")
    .update(payload)
    .eq("id", blogId)
    .select("*")
    .single();

  if (error) {
    throw new AppError(error.message || "Bloq yenilənə bilmədi", 500);
  }

  return updated;
}

export async function deleteBlogService(id) {
  const supabaseAdmin = getSupabaseAdmin();
  const blogId = Number(id);
  if (!Number.isFinite(blogId)) {
    throw new AppError("Blog id düzgün deyil", 400);
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("blogs")
    .select("id, img_url")
    .eq("id", blogId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError(fetchError.message || "Bloq tapıla bilmədi", 500);
  }
  if (!existing) {
    throw new AppError("Bloq tapılmadı", 404);
  }

  const bucketName = getBlogsBucketName();
  const storagePath = extractStoragePathFromPublicUrl(existing.img_url, bucketName);

  if (storagePath) {
    const { error: storageError } = await supabaseAdmin.storage
      .from(bucketName)
      .remove([storagePath]);

    if (storageError) {
      throw new AppError(storageError.message || "Şəkil storage-dən silinə bilmədi", 500);
    }
  }

  const { error: deleteError } = await supabaseAdmin.from("blogs").delete().eq("id", blogId);

  if (deleteError) {
    throw new AppError(deleteError.message || "Bloq silinə bilmədi", 500);
  }

  return { deletedId: blogId };
}