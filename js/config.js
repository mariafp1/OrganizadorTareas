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
 *
 * allowSignup: si es false, la web no muestra la opción de crear cuenta.
 * Para bloquear de verdad los registros, desactiva también en Supabase
 * Authentication → Sign In / Providers → "Allow new users to sign up".
 */
window.APP_CONFIG = {
  supabase: {
    url: 'https://lnsqoiykxireckzrvbnx.supabase.co',
    anonKey: 'sb_publishable_Zqfrt56uELucTOD_gA1YfA_xg04ZmY_',
    allowSignup: false,
  },
};
