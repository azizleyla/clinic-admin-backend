import { AppSuccess } from "../../common/AppSuccess.js"
import { respondHttpError } from "../../common/respondHttpError.js"
import { AppError } from "../../common/AppError.js"
import {
  createBlogService,
  deleteBlogService,
  editBlogService,
  getBlogByIdService,
  getBlogsService,
  parseBlogsListQuery,
} from "./blogs.service.js"

/** Postman raw JSON: image_base64 və ya data URL */
function decodeBase64Image(image_base64) {
  const compact = String(image_base64 ?? "").replace(/\s/g, "");
  if (!compact) return null;
  const dataUrl = /^data:(image\/[\w.+-]+);base64,(.+)$/i.exec(compact);
  if (dataUrl) {
    try {
      return {
        buffer: Buffer.from(dataUrl[2], "base64"),
        mime: dataUrl[1].split(";")[0].toLowerCase(),
      };
    } catch {
      return null;
    }
  }
  try {
    return { buffer: Buffer.from(compact, "base64"), mime: null };
  } catch {
    return null;
  }
}

export async function getBlogs(req, res) {
          try {
                    const listQuery = parseBlogsListQuery(req.query)
                    const { items, fields } = await getBlogsService({
                              ...listQuery,
                              clinicId: req.clinicId,
                    })
                    AppSuccess.send(res, 200, items, {
                              message: "Bloqlar siyahısı uğurla gətirildi",
                              fields,
                    })
          } catch (e) {
                    respondHttpError(res, e)
          }
}

export async function getBlogById(req, res) {
          try {
                    const result = await getBlogByIdService(req.params.id, req.clinicId)
                    AppSuccess.send(res, 200, result, { message: "Bloq uğurla gətirildi" })
          } catch (e) {
                    respondHttpError(res, e)
          }
}

export async function createBlog(req, res) {
          try {
                    const { title, slug, content, excerpt, category_id, tags, published_at } = req.body ?? {}
                    const imageFile = req.file
                    const result = await createBlogService({
                              title,
                              slug,
                              content,
                              excerpt,
                              category_id,
                              tags,
                              published_at,
                              imageFile,
                              clinicId: req.clinicId,
                    })
                    AppSuccess.send(res, 201, result, { message: "Bloq uğurla yaradıldı" })
          } catch (e) {
                    respondHttpError(res, e)
          }
}


export async function editBlog(req, res) {
          try {
                    const { id } = req.params ?? {}
                    const { title, slug, content, excerpt, category_id, tags, published_at } = req.body ?? {}
                    const imageFile = req.file
                    const result = await editBlogService(id, {
                              title,
                              slug,
                              content,
                              excerpt,
                              category_id,
                              tags,
                              published_at,
                              imageFile,
                    }, req.clinicId)
                    AppSuccess.send(res, 200, result, { message: "Bloq uğurla yeniləndi" })
          } catch (e) {
                    respondHttpError(res, e)
          }
}

export async function deleteBlog(req, res) {
          try {
                    const { id } = req.params ?? {}
                    const result = await deleteBlogService(id, req.clinicId)
                    AppSuccess.send(res, 200, result, { message: "Bloq uğurla silindi" })
          } catch (e) {
                    respondHttpError(res, e)
          }
}
