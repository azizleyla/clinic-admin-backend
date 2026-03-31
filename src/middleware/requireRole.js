/**
 * requireAuth-dan SONRA işlədin.
 * profiles.role sahəsi ilə uyğunlaşdırın (məs: "admin").
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    console.log(req.auth?.profile?.role,'rr')
    const role = req.auth?.profile?.role
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ message: "Bu əməliyyat üçün icazə yoxdur" })
    }
    next()
  }
}
