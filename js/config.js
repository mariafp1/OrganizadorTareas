/*
 * Configuración de Supabase.
 *
 * Copia aquí los datos de tu proyecto (Supabase → Project Settings → API):
 *   - url:     "Project URL"
 *   - anonKey: clave "anon" / "publishable" (es pública por diseño; los datos
 *              están protegidos por las políticas RLS de supabase/schema.sql).
 *
 * Si se dejan vacíos, la web funciona en "modo local": los datos se guardan
 * solo en este navegador (útil para probar).
 */
window.APP_CONFIG = {
  supabase: {
    url: '',
    anonKey: '',
  },
};
