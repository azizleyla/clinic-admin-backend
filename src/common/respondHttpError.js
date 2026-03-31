import { AppError } from "./AppError.js"

/** Express route catch blokları üçün: AppError → status + toJSON, əks halda statusCode və ya 500 */
export function respondHttpError(res, err) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON())
  }
  const status = err.statusCode ?? 500
  return res.status(status).json({ message: err.message })
}
