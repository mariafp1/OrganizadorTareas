# Publicar la web con Supabase y Vercel

Con estos pasos tendrás la web en internet, con inicio de sesión, y tus tareas
guardadas en la nube para verlas desde cualquier dispositivo.

- **Supabase** guarda los datos y gestiona las cuentas (email y contraseña).
- **Vercel** publica la web.

Ambos tienen plan gratuito. Tardarás unos 15 minutos.

---

## 1. Crear la base de datos en Supabase

1. Entra en <https://supabase.com> y crea una cuenta (puedes usar tu cuenta de GitHub).
2. Pulsa **New project**:
   - **Name**: `organizador-tareas` (o el que quieras).
   - **Database Password**: pulsa *Generate a password* y guárdala en un sitio seguro.
   - **Region**: elige una de Europa (por ejemplo, *West EU (Ireland)* o *Central EU (Frankfurt)*).
   - Pulsa **Create new project** y espera un par de minutos.
3. En el menú de la izquierda, abre **SQL Editor** → **New query**.
4. Copia todo el contenido del archivo [`supabase/schema.sql`](../supabase/schema.sql), pégalo y pulsa **Run**.
   Debe aparecer *Success. No rows returned*.

Esto crea las tablas de tareas y personas, y las protege para que cada cuenta
solo pueda ver y modificar sus propios datos.

## 2. Copiar las claves en la web

1. En Supabase, ve a **Project Settings** (rueda dentada) → **API** (o **Data API** / **API Keys**).
2. Copia estos dos valores:
   - **Project URL**: algo como `https://abcdefgh.supabase.co`.
   - La clave **anon** / **public** (o **publishable**): un texto largo.
     **No** copies la clave `service_role` ni la `secret`: esas nunca deben ir en la web.
3. Abre el archivo `js/config.js` del repositorio en GitHub, pulsa el lápiz para editarlo y rellena:

   ```js
   window.APP_CONFIG = {
     supabase: {
       url: 'https://abcdefgh.supabase.co',
       anonKey: 'la-clave-anon-que-has-copiado',
     },
   };
   ```

   Guarda con **Commit changes** en la rama `main`.

> La clave *anon* es pública por diseño: cualquiera que abra la web puede verla.
> Lo que protege tus datos son las reglas de seguridad creadas en el paso 1.

## 3. Publicar en Vercel

1. Entra en <https://vercel.com> e inicia sesión con tu cuenta de GitHub.
2. Pulsa **Add New…** → **Project**.
3. Busca el repositorio **OrganizadorTareas** y pulsa **Import**.
   (Si no aparece, pulsa *Adjust GitHub App Permissions* y dale acceso a ese repositorio.)
4. En la configuración:
   - **Framework Preset**: `Other`.
   - **Root Directory**: déjalo como está (`./`).
   - **Build Command** y **Output Directory**: déjalos vacíos.
5. Pulsa **Deploy**. En menos de un minuto tendrás una dirección del tipo
   `https://organizador-tareas.vercel.app`.

Cada vez que se suba un cambio a la rama `main`, Vercel volverá a publicar la web automáticamente.

## 4. Decirle a Supabase cuál es tu web

Es necesario para que funcionen los emails de confirmación y de cambio de contraseña.

1. En Supabase, ve a **Authentication** → **URL Configuration**.
2. En **Site URL** pon la dirección de Vercel, por ejemplo `https://organizador-tareas.vercel.app`.
3. En **Redirect URLs** pulsa **Add URL** y añade la misma dirección.
4. Guarda.

## 5. Crear tu cuenta

1. Abre tu web de Vercel.
2. Pulsa **¿No tienes cuenta? Crear una**, escribe tu email y una contraseña.
3. Te llegará un email de Supabase: abre el enlace para confirmar la cuenta.
4. Vuelve a la web e inicia sesión. Ya puedes usarla desde el móvil, el portátil, etc. con el mismo email y contraseña.

## 6. (Recomendado) Cerrar el registro a otras personas

Cuando ya tengas tu cuenta creada, puedes impedir que otras personas se registren en tu web:

1. En Supabase, ve a **Authentication** → **Sign In / Providers** (o **Providers** → **Email**).
2. Desactiva **Allow new users to sign up**.
3. Guarda.

Tú podrás seguir entrando con normalidad.

---

## Preguntas frecuentes

**¿Se pueden perder los datos?**
Los datos están en la base de datos de Supabase, no en el navegador. Puedes borrar
el historial, cambiar de móvil o de ordenador y seguirán ahí.

**Supabase dice que mi proyecto está en pausa.**
En el plan gratuito, Supabase pausa los proyectos que no se usan durante una semana.
Los datos no se borran: entra en el panel de Supabase y pulsa **Restore project**.

**He olvidado la contraseña.**
En la pantalla de inicio de sesión pulsa **¿Has olvidado la contraseña?** y te llegará
un email con un enlace para elegir una nueva.

**¿Puedo probar la web sin configurar Supabase?**
Sí. Con `js/config.js` vacío la web funciona en *modo local*: los datos se guardan solo
en ese navegador y aparece un aviso amarillo arriba.
