# Organizador de Tareas

Web para organizar tareas de **trabajo** y **personales** en dos tablones completamente separados.

## Versión 1 — Tareas

- **Dos tablones independientes**: Trabajo y Personal. Cada uno tiene sus propias tareas y sus propias personas; nada se comparte entre ellos.
- **Mis tareas / Del equipo / Todas**: filtra rápidamente lo que te toca a ti o lo que tiene tu equipo.
- **Dos vistas**:
  - *Tablero*: columnas Pendiente · En curso · Bloqueado · Hecho. Arrastra las tarjetas para cambiar su estado.
  - *Por persona*: cada miembro con sus tareas, recuento por estado, tareas vencidas y porcentaje completado.
- **Tareas** con título, descripción, persona asignada, estado, prioridad (alta/media/baja) y fecha límite. Las vencidas se marcan en rojo.
- **Gestión del equipo** (botón 👥): añadir, renombrar o quitar personas de cada tablón.
- Filtros por persona y prioridad, y buscador.
- Atajo de teclado: `n` para crear una tarea nueva.
- Diseño adaptable a móvil y modo oscuro automático.

## Cómo usarla

No necesita instalación ni compilación: abre `index.html` en el navegador.

También puedes servirla en local:

```bash
python3 -m http.server 8000
# y abre http://localhost:8000
```

La primera vez se cargan unos datos de ejemplo para que veas cómo funciona.

## Datos

En esta versión los datos se guardan en el `localStorage` del navegador, en una clave distinta por tablón
(`organizador:v1:board:trabajo` y `organizador:v1:board:personal`). Esto significa que:

- Los datos se quedan en tu navegador y dispositivo.
- Tu equipo todavía no ve las tareas desde su ordenador: la lista de "equipo" la gestionas tú.

## Estructura

```
index.html        Estructura de la página y diálogos
css/styles.css    Estilos (tema claro/oscuro, responsive)
js/store.js       Carga y guardado de cada tablón por separado + datos de ejemplo
js/app.js         Interfaz: filtros, vistas, arrastrar y soltar, edición
```

## Próximos pasos posibles

- Backend y cuentas de usuario para compartir el tablón de trabajo con el equipo en tiempo real.
- Exportar / importar datos.
- Etiquetas, subtareas y comentarios.
- Vista de calendario por fechas límite.
