/*
 * Almacenamiento de datos.
 *
 * Cada tablón (trabajo / personal) se guarda en su propia clave de
 * localStorage, de modo que sus miembros y tareas están completamente
 * separados y nunca se mezclan.
 */
(function () {
  'use strict';

  const PREFIX = 'organizador:v1:';
  const BOARD_IDS = ['trabajo', 'personal'];

  const STATUSES = [
    { id: 'pendiente', name: 'Pendiente' },
    { id: 'en-curso', name: 'En curso' },
    { id: 'bloqueado', name: 'Bloqueado' },
    { id: 'hecho', name: 'Hecho' },
  ];

  const MEMBER_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isoDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function task(title, assigneeId, status, priority, dueOffset, description) {
    const now = new Date().toISOString();
    return {
      id: uid(),
      title,
      description: description || '',
      assigneeId,
      status,
      priority,
      dueDate: dueOffset == null ? '' : isoDate(dueOffset),
      createdAt: now,
      updatedAt: now,
    };
  }

  // Datos de ejemplo que se cargan solo la primera vez.
  function seedBoard(boardId) {
    if (boardId === 'trabajo') {
      const me = { id: 'me', name: 'Yo', color: MEMBER_COLORS[0], isMe: true };
      const ana = { id: uid(), name: 'Ana', color: MEMBER_COLORS[1] };
      const luis = { id: uid(), name: 'Luis', color: MEMBER_COLORS[2] };
      const marta = { id: uid(), name: 'Marta', color: MEMBER_COLORS[3] };
      return {
        id: 'trabajo',
        members: [me, ana, luis, marta],
        tasks: [
          task('Preparar presentación trimestral', me.id, 'en-curso', 'alta', 2, 'Resultados del Q3 y objetivos del Q4.'),
          task('Revisar propuesta de cliente', me.id, 'pendiente', 'media', 5),
          task('Responder correos pendientes', me.id, 'hecho', 'baja', -1),
          task('Actualizar documentación de la API', ana.id, 'en-curso', 'media', 4),
          task('Corregir error en el formulario de alta', luis.id, 'pendiente', 'alta', -1, 'Los usuarios no reciben el correo de confirmación.'),
          task('Planificar sprint siguiente', marta.id, 'pendiente', 'media', 7),
          task('Migrar base de datos de pruebas', ana.id, 'bloqueado', 'alta', 3, 'Esperando acceso al servidor por parte de sistemas.'),
          task('Entrevista candidato frontend', marta.id, 'hecho', 'media', -3),
        ],
      };
    }
    const me = { id: 'me', name: 'Yo', color: MEMBER_COLORS[4], isMe: true };
    return {
      id: 'personal',
      members: [me],
      tasks: [
        task('Hacer la compra', me.id, 'pendiente', 'media', 0),
        task('Pedir cita con el médico', me.id, 'pendiente', 'alta', 3),
        task('Leer 30 páginas del libro', me.id, 'en-curso', 'baja', null),
        task('Pagar el recibo de la luz', me.id, 'hecho', 'alta', -2),
      ],
    };
  }

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('No se pudo guardar en localStorage', e);
    }
  }

  function loadBoard(boardId) {
    const raw = safeGet(PREFIX + 'board:' + boardId);
    if (raw) {
      try {
        const board = JSON.parse(raw);
        if (board && Array.isArray(board.members) && Array.isArray(board.tasks)) return board;
      } catch (e) {
        console.warn('Datos corruptos en el tablón', boardId, e);
      }
    }
    const board = seedBoard(boardId);
    saveBoard(board);
    return board;
  }

  function saveBoard(board) {
    safeSet(PREFIX + 'board:' + board.id, JSON.stringify(board));
  }

  function loadUI() {
    const defaults = { activeBoard: 'trabajo', scope: 'all', view: 'kanban' };
    const raw = safeGet(PREFIX + 'ui');
    if (!raw) return defaults;
    try {
      return Object.assign(defaults, JSON.parse(raw));
    } catch (e) {
      return defaults;
    }
  }

  function saveUI(ui) {
    safeSet(PREFIX + 'ui', JSON.stringify(ui));
  }

  window.Store = {
    BOARD_IDS,
    STATUSES,
    MEMBER_COLORS,
    uid,
    loadBoard,
    saveBoard,
    loadUI,
    saveUI,
  };
})();
