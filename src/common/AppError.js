/**
 * Domain / HTTP xətaları üçün vahid Error alt sinfi.
 * Controller-lərdə: catch-də instanceof AppError → statusCode ilə cavab.
 */
export class AppError extends Error {
  /**
   * @param {string} message — istifadəçiyə göstərilə bilən mesaj
   * @param {number} [statusCode=500]
   * @param {{ code?: string, details?: unknown }} [options]
   */
  constructor(message, statusCode = 500, options = {}) {
    super(message)
    this.name = "AppError"
    this.statusCode = statusCode
    this.code = options.code ?? null
    this.details = options.details ?? null
    Error.captureStackTrace?.(this, this.constructor)
  }

  /** res.status(...).json(...) üçün gövdə */
  toJSON() {
    const body = { message: this.message }
    if (this.code) body.code = this.code
    return body
  }
}
