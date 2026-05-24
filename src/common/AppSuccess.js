/**
 * Uğurlu API: { success: true, status, data, message?, meta? }
 * status — HTTP kodu (200, 201, …). Cavab başlığında da eyni kod gedir.
 */
export class AppSuccess {
  /**
   * @param {unknown} data
   * @param {{ status?: number, meta?: Record<string, unknown>, message?: string }} [options]
   */
  constructor(data, options = {}) {
    this.data = data
    this.status = options.status
    this.message = options.message
    this.meta = options.meta
  }

  toJSON() {
    const body = { success: true, data: this.data }
    if (this.status !== undefined) body.status = this.status
    if (this.message !== undefined) body.message = this.message
    if (this.meta !== undefined) body.meta = this.meta
    return body
  }

  /**
   * @param {import("express").Response} res
   * @param {number} status — HTTP status (res.status ilə eyni)
   * @param {unknown} data
   * @param {{ meta?: Record<string, unknown>, message?: string, fields?: Record<string, unknown> }} [options]
   */
  static send(res, status, data, options = {}) {
    const body = { success: true, status, data }
    if (options.message !== undefined) body.message = options.message
    if (options.meta !== undefined) body.meta = options.meta
    if (options.fields) Object.assign(body, options.fields)
    res.status(status).json(body)
  }
}
