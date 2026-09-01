/**
 * Şöbə ikonları üçün paylaşılan SEMANTİK açarlar.
 *
 * DB-də `departments.icon_name` yalnız bu açarlardan birini saxlayır (məs. "cardiology").
 * Hər frontend bu açarı öz ikon kitabxanasının komponentinə map edir:
 *   - public sayt (nextjs-clinic) → react-icons
 *   - admin panel (clinic-admin-front) → @mui/icons-material
 *
 * Yeni şöbə tipi əlavə edəndə açarı buraya, həm də hər iki frontend-in
 * icon map-inə eyni adla əlavə edin (paylaşılan npm paketi olmadığı üçün
 * sinxronluq konvensiya ilə saxlanır).
 */
export const DEPARTMENT_ICON_KEYS = [
  "cardiology",
  "neurology",
  "ophthalmology",
  "endocrinology",
  "dentistry",
  "physiotherapy",
  "emergency",
  "reanimation",
  "urology",
  "pediatrics",
  "surgery",
  "general",
];

/** Naməlum/boş dəyər üçün default açar. */
export const DEFAULT_DEPARTMENT_ICON = "general";

export function isValidDepartmentIcon(value) {
  return DEPARTMENT_ICON_KEYS.includes(String(value ?? "").trim());
}
