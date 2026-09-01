import { AppSuccess } from "../../common/AppSuccess.js";
import { respondHttpError } from "../../common/respondHttpError.js";
import {
  getBranchByIdService,
  getBranchesService,
} from "./branches.service.js";

export async function getBranches(req, res) {
  try {
    const result = await getBranchesService();
    AppSuccess.send(res, 200, result, { message: "Filial siyahısı gətirildi" });
  } catch (e) {
    respondHttpError(res, e);
  }
}

export async function getBranchById(req, res) {
  try {
    const { id } = req.params ?? {};
    const result = await getBranchByIdService(id);
    AppSuccess.send(res, 200, result, { message: "Filial gətirildi" });
  } catch (e) {
    respondHttpError(res, e);
  }
}
