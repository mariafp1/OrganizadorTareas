# Organizador de Tareas

Web para organizar tareas de **trabajo** y **personales** en dos tablones completamente separados.

## Versión 1 — Tareas

- **Dos tablones independientes**: Trabajo y Personal. Cada uno tiene sus propias tareas y sus propias personas; nada se comparte entre ellos.
- **Mis tareas / Del equipo / Todas**: filtra rápidamente lo que te toca a ti o lo que tiene tu equipo.
- **Dos vistas**:
  - *Tablero*: bloques Pendiente · En curso · Bloqueado · Hecho, uno debajo de otro. Pendiente y En curso están divididos en dos: a la izquierda lo más urgente y a la derecha lo menos urgente. Arrastra las tarjetas para cambiar su estado o su urgencia. Las tareas bloqueadas pueden llevar un motivo opcional.
  - *Por persona*: cada miembro con sus tareas, recuento por estado, tareas vencidas y porcentaje completado.
- **Tareas** con título, descripción, persona asignada, estado, prioridad (alta/media/baja) y fecha límite. Las vencidas se marcan en rojo.
- **Gestión del equipo** (botón Equipo / Personas): añadir, renombrar o quitar personas de cada tablón.
- Filtros por persona y prioridad, y buscador.
- Atajo de teclado: `n` para crear una tarea nueva.
- Diseño adaptable a móvil y modo oscuro automático.
- **Cuenta con email y contraseña**: tus tareas se guardan en la nube (Supabase) y las ves desde cualquier dispositivo.

## Publicarla

Sigue la guía paso a paso: **[docs/PUBLICAR.md](docs/PUBLICAR.md)** (Supabase para los datos y Vercel para la web).

## Probarla en local

No necesita instalación ni compilación. Con `js/config.js` vacío funciona en *modo local*
(los datos se guardan solo en el navegador):

```bash
python3 -m http.server 8000
# y abre http://localhost:8000
```

## Datos

- **Con Supabase configurado**: cada usuario inicia sesión y sus personas y tareas se guardan en las
  tablas `members` y `tasks`. Las políticas de seguridad (RLS) de [`supabase/schema.sql`](supabase/schema.sql)
  impiden que una cuenta vea o modifique los datos de otra. Los tablones se distinguen por la columna `board`.
- **Modo local**: los datos se guardan en el `localStorage` del navegador, con una clave por tablón.

## Estructura

```
index.html                 Estructura de la página, inicio de sesión y diálogos
css/styles.css             Estilos (tema claro/oscuro, responsive)
js/config.js               URL y clave pública de Supabase
js/store.js                Guardado de datos: Supabase o modo local
js/app.js                  Interfaz: filtros, vistas, arrastrar y soltar, edición, inicio de sesión
js/vendor/                 Librería de Supabase (supabase-js 2.117.1, licencia MIT)
supabase/schema.sql        Tablas y reglas de seguridad de la base de datos
vercel.json                Cabeceras de seguridad y caché para Vercel
docs/PUBLICAR.md           Guía para publicar la web
```

## Próximos pasos posibles

- Compartir el tablón de trabajo con el equipo (que cada persona entre con su cuenta y vea sus tareas).
- Sincronización en tiempo real entre dispositivos abiertos a la vez (ahora se actualiza al volver a la pestaña).
- Exportar / importar datos.
- Etiquetas, subtareas y comentarios.
- Vista de calendario por fechas límite.
