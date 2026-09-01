import { AppSuccess } from "../../common/AppSuccess.js";
import { respondHttpError } from "../../common/respondHttpError.js";
import {
  createHeroSlideService,
  deleteHeroSlideService,
  editHeroSlideService,
  getHeroSlideByIdService,
  getHeroSlidesService,
  reorderHeroSlidesService,
} from "./hero_slides.service.js";

export async function getHeroSlides(req, res) {
  try {
    const items = await getHeroSlidesService({
      ...req.query,
      clinicId: req.clinicId,
    });
    AppSuccess.send(res, 200, items, {
      message: "Sliderlər siyahısı gətirildi",
    });
  } catch (e) {
    respondHttpError(res, e);
  }
}
export async function reorderHeroSlides(req, res) {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body?.items;
    const result = await reorderHeroSlidesService(items, req.clinicId);
    AppSuccess.send(res, 200, result, { message: "Slider sıralaması yeniləndi" });
  } catch (e) {
    respondHttpError(res, e);
  }
}

export async function getHeroSlideById(req, res) {
  try {
    const result = await getHeroSlideByIdService(req.params.id, req.clinicId);
    AppSuccess.send(res, 200, result, { message: "Slider gətirildi" });
  } catch (e) {
    respondHttpError(res, e);
  }
}

export async function createHeroSlide(req, res) {
  try {
    const { title, description, is_active } = req.body ?? {};
    const imageFile = req.file;
    const result = await createHeroSlideService({
      title,
      description,
      is_active,
      imageFile,
      clinicId: req.clinicId,
    });
    AppSuccess.send(res, 201, result, { message: "Slider yaradıldı" });
  } catch (e) {
    respondHttpError(res, e);
  }
}

export async function editHeroSlide(req, res) {
  try {
    const { id } = req.params ?? {};
    const { title, description, is_active } = req.body ?? {};
    const imageFile = req.file;
    const result = await editHeroSlideService(id, {
      title,
      description,
      is_active,
      imageFile,
    }, req.clinicId);
    AppSuccess.send(res, 200, result, { message: "Slider yeniləndi" });
  } catch (e) {
    respondHttpError(res, e);
  }
}

export async function deleteHeroSlide(req, res) {
  try {
    const { id } = req.params ?? {};
    const result = await deleteHeroSlideService(id, req.clinicId);
    AppSuccess.send(res, 200, result, { message: "Slider silindi" });
  } catch (e) {
    respondHttpError(res, e);
  }
}
