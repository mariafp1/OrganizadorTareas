/*
 * Almacenamiento de datos.
 *
 * Dos modos con la misma interfaz (todas las operaciones son asíncronas):
 *  - Supabase: si js/config.js tiene url y anonKey. Los datos se guardan en
 *    la nube, ligados a la cuenta del usuario, y se ven desde cualquier
 *    dispositivo.
 *  - Local: sin configuración. Los datos se guardan solo en este navegador.
 *
 * En ambos modos los tablones (trabajo / personal) están separados: cada
 * miembro y cada tarea pertenece a un único tablón.
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
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
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
          Object.assign(task('Preparar presentación trimestral', me.id, 'en-curso', 'alta', 2, 'Resultados del Q3 y objetivos del Q4.'), { urgent: true }),
          task('Revisar propuesta de cliente', me.id, 'pendiente', 'media', 5),
          task('Responder correos pendientes', me.id, 'hecho', 'baja', -1),
          task('Actualizar documentación de la API', ana.id, 'en-curso', 'media', 4),
          Object.assign(task('Corregir error en el formulario de alta', luis.id, 'pendiente', 'alta', -1, 'Los usuarios no reciben el correo de confirmación.'), { urgent: true }),
          task('Planificar sprint siguiente', marta.id, 'pendiente', 'media', 7),
          Object.assign(task('Migrar base de datos de pruebas', ana.id, 'bloqueado', 'alta', 3), { blockedReason: 'Esperando acceso al servidor por parte de sistemas.' }),
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
        Object.assign(task('Pedir cita con el médico', me.id, 'pendiente', 'alta', 3), { urgent: true }),
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

  // Preferencias de la interfaz (tablón activo, vista…): siempre en el navegador.
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

  // ---------- Modo local (localStorage) ----------

  function localBackend() {
    const boards = {};

    function key(boardId) {
      return PREFIX + 'board:' + boardId;
    }

    function read(boardId) {
      const raw = safeGet(key(boardId));
      if (raw) {
        try {
          const board = JSON.parse(raw);
          if (board && Array.isArray(board.members) && Array.isArray(board.tasks)) return board;
        } catch (e) {
          console.warn('Datos corruptos en el tablón', boardId, e);
        }
      }
      return seedBoard(boardId);
    }

    function write(boardId) {
      safeSet(key(boardId), JSON.stringify(boards[boardId]));
    }

    function findTask(id) {
      for (const b of BOARD_IDS) {
        const t = boards[b].tasks.find((x) => x.id === id);
        if (t) return [b, t];
      }
      return [];
    }

    function findMember(id) {
      for (const b of BOARD_IDS) {
        const m = boards[b].members.find((x) => x.id === id);
        if (m) return [b, m];
      }
      return [];
    }

    return {
      mode: 'local',
      async getUser() { return null; },
      onAuthChange() {},
      async loadBoards() {
        BOARD_IDS.forEach((b) => { boards[b] = read(b); write(b); });
        return JSON.parse(JSON.stringify(boards));
      },
      async insertTask(boardId, t) {
        boards[boardId].tasks.push(Object.assign({}, t));
        write(boardId);
      },
      async updateTask(id, patch) {
        const [b, t] = findTask(id);
        if (!t) return;
        Object.assign(t, patch);
        write(b);
      },
      async deleteTask(id) {
        const [b] = findTask(id);
        if (!b) return;
        boards[b].tasks = boards[b].tasks.filter((x) => x.id !== id);
        write(b);
      },
      async insertMember(boardId, m) {
        boards[boardId].members.push(Object.assign({}, m));
        write(boardId);
      },
      async updateMember(id, patch) {
        const [b, m] = findMember(id);
        if (!m) return;
        Object.assign(m, patch);
        write(b);
      },
      async deleteMember(id) {
        const [b] = findMember(id);
        if (!b) return;
        boards[b].members = boards[b].members.filter((x) => x.id !== id);
        boards[b].tasks.forEach((t) => { if (t.assigneeId === id) t.assigneeId = ''; });
        write(b);
      },
    };
  }

  // ---------- Modo Supabase ----------

  function taskFromRow(r) {
    return {
      id: r.id,
      title: r.title,
      description: r.description || '',
      assigneeId: r.assignee_id || '',
      status: r.status,
      priority: r.priority,
      dueDate: r.due_date || '',
      urgent: !!r.urgent,
      blockedReason: r.blocked_reason || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  const TASK_COLUMNS = {
    id: 'id',
    title: 'title',
    description: 'description',
    assigneeId: 'assignee_id',
    status: 'status',
    priority: 'priority',
    dueDate: 'due_date',
    urgent: 'urgent',
    blockedReason: 'blocked_reason',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  function taskToRow(t) {
    const row = {};
    Object.entries(t).forEach(([k, v]) => {
      const col = TASK_COLUMNS[k];
      if (!col) return;
      // Cadena vacía = sin valor para la persona asignada y la fecha.
      row[col] = (k === 'assigneeId' || k === 'dueDate') && !v ? null : v;
    });
    return row;
  }

  function memberFromRow(r) {
    return { id: r.id, name: r.name, color: r.color, isMe: !!r.is_me };
  }

  function memberToRow(m) {
    const row = {};
    if ('id' in m) row.id = m.id;
    if ('name' in m) row.name = m.name;
    if ('color' in m) row.color = m.color;
    if ('isMe' in m) row.is_me = !!m.isMe;
    return row;
  }

  function supabaseBackend(cfg) {
    const client = window.supabase.createClient(cfg.url, cfg.anonKey);

    // Lanza el error de Supabase para que la interfaz pueda avisar.
    function check({ data, error }) {
      if (error) throw error;
      return data;
    }

    async function ensureMe(boardId, members) {
      if (members.some((m) => m.isMe)) return members;
      const me = { id: uid(), name: 'Yo', color: boardId === 'trabajo' ? MEMBER_COLORS[0] : MEMBER_COLORS[4], isMe: true };
      const { error } = await client.from('members').insert(Object.assign({ board: boardId }, memberToRow(me)));
      if (!error) return [me].concat(members);
      // Otro dispositivo lo creó a la vez: volver a leer.
      const rows = check(await client.from('members').select('*').eq('board', boardId).order('created_at'));
      return rows.map(memberFromRow);
    }

    return {
      mode: 'supabase',
      client,
      async getUser() {
        const { data } = await client.auth.getSession();
        return data.session ? data.session.user : null;
      },
      onAuthChange(cb) {
        client.auth.onAuthStateChange((event, session) => cb(event, session ? session.user : null));
      },
      async signIn(email, password) {
        check(await client.auth.signInWithPassword({ email, password }));
      },
      async signUp(email, password) {
        const data = check(await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + window.location.pathname },
        }));
        return { needsConfirmation: !data.session };
      },
      async resetPassword(email) {
        check(await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname,
        }));
      },
      async updatePassword(password) {
        check(await client.auth.updateUser({ password }));
      },
      async signOut() {
        check(await client.auth.signOut());
      },
      async loadBoards() {
        const [members, tasks] = await Promise.all([
          client.from('members').select('*').order('created_at'),
          client.from('tasks').select('*').order('created_at'),
        ]);
        const memberRows = check(members);
        const taskRows = check(tasks);
        const boards = {};
        for (const b of BOARD_IDS) {
          boards[b] = {
            id: b,
            members: await ensureMe(b, memberRows.filter((r) => r.board === b).map(memberFromRow)),
            tasks: taskRows.filter((r) => r.board === b).map(taskFromRow),
          };
        }
        return boards;
      },
      async insertTask(boardId, t) {
        check(await client.from('tasks').insert(Object.assign({ board: boardId }, taskToRow(t))));
      },
      async updateTask(id, patch) {
        check(await client.from('tasks').update(taskToRow(patch)).eq('id', id));
      },
      async deleteTask(id) {
        check(await client.from('tasks').delete().eq('id', id));
      },
      async insertMember(boardId, m) {
        check(await client.from('members').insert(Object.assign({ board: boardId }, memberToRow(m))));
      },
      async updateMember(id, patch) {
        check(await client.from('members').update(memberToRow(patch)).eq('id', id));
      },
      async deleteMember(id) {
        // La base de datos deja sus tareas sin asignar (on delete set null).
        check(await client.from('members').delete().eq('id', id));
      },
    };
  }

  function createBackend() {
    const cfg = (window.APP_CONFIG && window.APP_CONFIG.supabase) || {};
    if (cfg.url && cfg.anonKey) {
      if (!window.supabase) throw new Error('No se ha cargado la librería de Supabase.');
      return supabaseBackend(cfg);
    }
    return localBackend();
  }

  window.Store = {
    BOARD_IDS,
    STATUSES,
    MEMBER_COLORS,
    uid,
    loadUI,
    saveUI,
    createBackend,
  };
})();
