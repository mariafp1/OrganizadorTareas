/*
 * Lógica de la interfaz: tablones, filtros, vistas y edición de tareas.
 */
(function () {
  'use strict';

  const { STATUSES, MEMBER_COLORS } = Store;

  const BOARD_CONFIG = {
    trabajo: {
      title: 'Trabajo',
      membersLabel: 'Equipo',
      othersScope: 'Del equipo',
      membersHint: 'Personas de tu equipo a las que puedes asignar tareas de trabajo.',
    },
    personal: {
      title: 'Personal',
      membersLabel: 'Personas',
      othersScope: 'De otros',
      membersHint: 'Personas con las que compartes tareas personales (pareja, familia, amigos…). Este listado es independiente del equipo de trabajo.',
    },
  };

  const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };
  const PRIORITY_LABEL = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  const UNASSIGNED = '__none__';
  // Bloques divididos en más urgente (izquierda) y menos urgente (derecha).
  const SPLIT_STATUSES = ['pendiente', 'en-curso'];

  const ui = Store.loadUI();
  if (!Store.BOARD_IDS.includes(ui.activeBoard)) ui.activeBoard = 'trabajo';

  let backend;
  let boards = null;
  let currentUser = null;

  // Filtros que no se guardan entre sesiones.
  const filters = { member: '', priority: '', search: '' };

  // ---------- Utilidades ----------

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        if (value == null || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'style') node.style.cssText = value;
        else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? '' : value);
      });
    }
    (children || []).forEach((child) => {
      if (child == null) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function board() {
    return boards[ui.activeBoard];
  }

  let toastTimer = null;
  function toast(message) {
    const node = $('#toast');
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 5000);
  }

  // Los cambios se muestran al momento y se guardan en segundo plano. Si el
  // guardado falla, se avisa y se recargan los datos reales.
  function persist(promise) {
    promise.catch((err) => {
      console.error(err);
      toast('No se ha podido guardar el cambio. Revisa tu conexión; se han recargado los datos.');
      refresh();
    });
  }

  function pick(obj, keys) {
    const out = {};
    keys.forEach((k) => { out[k] = obj[k]; });
    return out;
  }

  function me() {
    return board().members.find((m) => m.isMe);
  }

  function memberById(id) {
    return board().members.find((m) => m.id === id);
  }

  function displayName(m) {
    return m.isMe && m.name.toLowerCase() !== 'yo' ? m.name + ' (yo)' : m.name;
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
  }

  function todayISO() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function isOverdue(t) {
    return t.dueDate && t.status !== 'hecho' && t.dueDate < todayISO();
  }

  function formatDue(dateStr) {
    if (!dateStr) return '';
    const today = todayISO();
    if (dateStr === today) return 'Hoy';
    const diff = Math.round((new Date(dateStr) - new Date(today)) / 86400000);
    if (diff === 1) return 'Mañana';
    if (diff === -1) return 'Ayer';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  function compareTasks(a, b) {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  }

  // ---------- Filtrado ----------

  function visibleTasks() {
    const meId = me().id;
    const q = filters.search.trim().toLowerCase();
    return board().tasks.filter((t) => {
      if (ui.scope === 'mine' && t.assigneeId !== meId) return false;
      if (ui.scope === 'team' && t.assigneeId === meId) return false;
      if (ui.scope !== 'mine' && filters.member) {
        if (filters.member === UNASSIGNED ? t.assigneeId : t.assigneeId !== filters.member) return false;
      }
      if (filters.priority && t.priority !== filters.priority) return false;
      if (q && ![t.title, t.description, t.blockedReason || ''].some((s) => s.toLowerCase().includes(q))) return false;
      return true;
    });
  }

  // ---------- Render ----------

  function render() {
    const cfg = BOARD_CONFIG[ui.activeBoard];
    document.body.dataset.board = ui.activeBoard;
    document.title = cfg.title + ' · Organizador de Tareas';

    $$('.board-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.board === ui.activeBoard));
    });
    $('#board-title').textContent = cfg.title;
    $('#members-label').textContent = cfg.membersLabel;
    $('#scope-filter [data-scope="team"]').textContent = cfg.othersScope;

    $$('#scope-filter button').forEach((b) => b.classList.toggle('active', b.dataset.scope === ui.scope));
    $$('#view-switch button').forEach((b) => b.classList.toggle('active', b.dataset.view === ui.view));

    renderMemberFilter();
    renderSummary();

    const tasks = visibleTasks();
    const kanban = $('#kanban');
    const people = $('#people');
    kanban.hidden = ui.view !== 'kanban';
    people.hidden = ui.view !== 'people';
    if (ui.view === 'kanban') renderKanban(tasks);
    else renderPeople(tasks);
  }

  function renderMemberFilter() {
    const select = $('#member-filter');
    const members = board().members;
    if (filters.member && filters.member !== UNASSIGNED && !memberById(filters.member)) filters.member = '';
    select.replaceChildren(
      el('option', { value: '', text: 'Todas' }),
      ...members
        .filter((m) => ui.scope !== 'team' || !m.isMe)
        .map((m) => el('option', { value: m.id, text: displayName(m) })),
      el('option', { value: UNASSIGNED, text: 'Sin asignar' }),
    );
    select.value = filters.member;
    select.disabled = ui.scope === 'mine';
    select.closest('label').classList.toggle('is-disabled', ui.scope === 'mine');
  }

  function renderSummary() {
    const meId = me().id;
    const mine = board().tasks.filter((t) => t.assigneeId === meId && t.status !== 'hecho');
    const open = board().tasks.filter((t) => t.status !== 'hecho');
    const overdue = open.filter(isOverdue);
    const parts = [
      `${mine.length} ${mine.length === 1 ? 'tarea abierta tuya' : 'tareas abiertas tuyas'}`,
      `${open.length} abiertas en total`,
    ];
    const blocked = open.filter((t) => t.status === 'bloqueado');
    if (blocked.length) parts.push(`${blocked.length} ${blocked.length === 1 ? 'bloqueada' : 'bloqueadas'}`);
    if (overdue.length) parts.push(`${overdue.length} ${overdue.length === 1 ? 'vencida' : 'vencidas'}`);
    $('#board-summary').textContent = parts.join(' · ');
  }

  function renderKanban(tasks) {
    const kanban = $('#kanban');
    kanban.replaceChildren(
      ...STATUSES.map((status) => {
        const colTasks = tasks.filter((t) => t.status === status.id).sort(compareTasks);
        const split = SPLIT_STATUSES.includes(status.id);

        const column = el('div', { class: 'column' + (split ? ' is-split' : ''), 'data-status': status.id }, [
          el('header', { class: 'column-head' }, [
            el('span', { class: 'status-dot status-' + status.id }),
            el('h2', { text: status.name }),
            el('span', { class: 'count', text: String(colTasks.length) }),
            split ? null : el('button', {
              class: 'icon-btn', type: 'button', title: 'Añadir tarea en ' + status.name,
              'aria-label': 'Añadir tarea en ' + status.name,
              onclick: () => openTaskDialog(null, { status: status.id }),
            }, ['+']),
          ]),
          split
            ? el('div', { class: 'column-halves' }, [true, false].map((urgent) =>
              urgencyHalf(status, urgent, colTasks.filter((t) => !!t.urgent === urgent))))
            : cardList(colTasks),
        ]);
        if (!split) setupDropZone(column, status.id);
        return column;
      }),
    );
  }

  function cardList(list) {
    return el('div', { class: 'column-list' },
      list.length ? list.map(taskCard) : [el('p', { class: 'empty', text: 'Sin tareas' })]);
  }

  // Mitad izquierda (más urgente) o derecha (menos urgente) de un bloque.
  function urgencyHalf(status, urgent, list) {
    const label = urgent ? 'Más urgente' : 'Menos urgente';
    const half = el('div', { class: 'half ' + (urgent ? 'half-urgent' : 'half-normal') }, [
      el('header', { class: 'half-head' }, [
        el('span', { text: label }),
        el('span', { class: 'count', text: String(list.length) }),
        el('button', {
          class: 'icon-btn', type: 'button', title: `Añadir tarea en ${status.name} (${label.toLowerCase()})`,
          'aria-label': `Añadir tarea en ${status.name} (${label.toLowerCase()})`,
          onclick: () => openTaskDialog(null, { status: status.id, urgent }),
        }, ['+']),
      ]),
      cardList(list),
    ]);
    setupDropZone(half, status.id, urgent);
    return half;
  }

  function taskCard(t) {
    const member = memberById(t.assigneeId);
    const overdue = isOverdue(t);
    const card = el('article', {
      class: 'card priority-' + t.priority + (t.status === 'hecho' ? ' is-done' : ''),
      draggable: 'true',
      tabindex: '0',
      'data-id': t.id,
      onclick: () => openTaskDialog(t),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTaskDialog(t); } },
      ondragstart: (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      },
      ondragend: () => card.classList.remove('dragging'),
    }, [
      el('h3', { class: 'card-title', text: t.title }),
      t.description ? el('p', { class: 'card-desc', text: t.description }) : null,
      t.status === 'bloqueado' && t.blockedReason
        ? el('p', { class: 'blocked-reason', text: t.blockedReason }) : null,
      el('footer', { class: 'card-meta' }, [
        el('span', { class: 'tag tag-' + t.priority, text: PRIORITY_LABEL[t.priority] }),
        t.dueDate ? el('span', { class: 'due' + (overdue ? ' overdue' : ''), title: t.dueDate, text: formatDue(t.dueDate) }) : null,
        el('span', { class: 'spacer' }),
        el('span', { class: 'assignee' + (member ? '' : ' assignee-empty') }, [
          avatar(member, 'sm'),
          el('span', { class: 'assignee-name', text: member ? displayName(member) : 'Sin asignar' }),
        ]),
      ]),
    ]);
    return card;
  }

  function avatar(member, size) {
    if (!member) {
      return el('span', { class: 'avatar avatar-empty' + (size ? ' avatar-' + size : ''), title: 'Sin asignar', text: '?' });
    }
    return el('span', {
      class: 'avatar' + (size ? ' avatar-' + size : ''),
      style: 'background:' + member.color,
      title: displayName(member),
      text: initials(member.name),
    });
  }

  function setStatus(t, statusId) {
    t.status = statusId;
    if (statusId !== 'bloqueado') t.blockedReason = '';
    t.updatedAt = new Date().toISOString();
  }

  function setupDropZone(column, statusId, urgent) {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('drop-target');
    });
    column.addEventListener('dragleave', (e) => {
      if (!column.contains(e.relatedTarget)) column.classList.remove('drop-target');
    });
    column.addEventListener('drop', (e) => {
      e.preventDefault();
      column.classList.remove('drop-target');
      const t = board().tasks.find((x) => x.id === e.dataTransfer.getData('text/plain'));
      const moveUrgency = urgent != null && t && !!t.urgent !== urgent;
      if (t && (t.status !== statusId || moveUrgency)) {
        if (urgent != null) t.urgent = urgent;
        if (t.status !== statusId) setStatus(t, statusId);
        else t.updatedAt = new Date().toISOString();
        persist(backend.updateTask(t.id, pick(t, ['status', 'urgent', 'blockedReason', 'updatedAt'])));
        render();
        if (statusId === 'bloqueado' && !moveUrgency) openTaskDialog(t, null, 'blockedReason');
      }
    });
  }

  function renderPeople(tasks) {
    const container = $('#people');
    const meId = me().id;
    let groups = board().members
      .filter((m) => (ui.scope === 'mine' ? m.isMe : ui.scope === 'team' ? !m.isMe : true))
      .map((m) => ({ member: m, tasks: tasks.filter((t) => t.assigneeId === m.id) }));
    const unassigned = tasks.filter((t) => !memberById(t.assigneeId));
    if (ui.scope !== 'mine' && unassigned.length) groups.push({ member: null, tasks: unassigned });
    if (filters.member) {
      groups = groups.filter((g) => (filters.member === UNASSIGNED ? !g.member : g.member && g.member.id === filters.member));
    }
    // "Yo" siempre primero, luego por número de tareas abiertas.
    groups.sort((a, b) => {
      if (a.member && a.member.id === meId) return -1;
      if (b.member && b.member.id === meId) return 1;
      return openCount(b.tasks) - openCount(a.tasks);
    });

    if (!groups.length) {
      container.replaceChildren(el('p', { class: 'empty big', text: 'No hay personas que coincidan con los filtros.' }));
      return;
    }

    container.replaceChildren(...groups.map(({ member, tasks: list }) => {
      const done = list.filter((t) => t.status === 'hecho').length;
      const pct = list.length ? Math.round((done / list.length) * 100) : 0;
      const counts = STATUSES.map((s) => el('span', { class: 'mini-count' }, [
        el('span', { class: 'status-dot status-' + s.id }),
        `${list.filter((t) => t.status === s.id).length} ${s.name.toLowerCase()}`,
      ]));
      const overdue = list.filter(isOverdue).length;
      if (overdue) counts.push(el('span', { class: 'mini-count overdue', text: `${overdue} vencida${overdue === 1 ? '' : 's'}` }));

      const sorted = list.slice().sort((a, b) =>
        (a.status === 'hecho') - (b.status === 'hecho') || compareTasks(a, b));

      return el('section', { class: 'person' }, [
        el('header', { class: 'person-head' }, [
          avatar(member, 'lg'),
          el('div', { class: 'person-info' }, [
            el('h2', { text: member ? displayName(member) : 'Sin asignar' }),
            el('div', { class: 'mini-counts' }, counts),
          ]),
          el('div', { class: 'progress', title: pct + '% completado' }, [
            el('div', { class: 'progress-bar', style: 'width:' + pct + '%' }),
          ]),
          el('span', { class: 'progress-label', text: pct + '%' }),
          member ? el('button', {
            class: 'icon-btn', type: 'button', title: 'Asignar tarea a ' + member.name,
            'aria-label': 'Asignar tarea a ' + member.name,
            onclick: () => openTaskDialog(null, { assigneeId: member.id }),
          }, ['+']) : null,
        ]),
        sorted.length
          ? el('ul', { class: 'person-tasks' }, sorted.map(personTaskRow))
          : el('p', { class: 'empty', text: 'Sin tareas' }),
      ]);
    }));
  }

  function openCount(list) {
    return list.filter((t) => t.status !== 'hecho').length;
  }

  function personTaskRow(t) {
    const statusName = STATUSES.find((s) => s.id === t.status).name;
    return el('li', {
      class: 'person-task' + (t.status === 'hecho' ? ' is-done' : ''),
      tabindex: '0',
      onclick: () => openTaskDialog(t),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTaskDialog(t); } },
    }, [
      el('input', {
        type: 'checkbox',
        checked: t.status === 'hecho',
        'aria-label': 'Marcar como hecha',
        onclick: (e) => e.stopPropagation(),
        onchange: (e) => {
          setStatus(t, e.target.checked ? 'hecho' : 'pendiente');
          persist(backend.updateTask(t.id, pick(t, ['status', 'blockedReason', 'updatedAt'])));
          render();
        },
      }),
      el('span', { class: 'person-task-title' }, [
        t.urgent && SPLIT_STATUSES.includes(t.status) ? el('span', { class: 'urgent-mark', text: 'Urgente' }) : null,
        t.title,
        t.status === 'bloqueado' && t.blockedReason
          ? el('span', { class: 'blocked-reason inline', text: t.blockedReason }) : null,
      ]),
      el('span', { class: 'status-pill status-pill-' + t.status, text: statusName }),
      el('span', { class: 'tag tag-' + t.priority, text: PRIORITY_LABEL[t.priority] }),
      el('span', { class: 'due' + (isOverdue(t) ? ' overdue' : ''), text: t.dueDate ? formatDue(t.dueDate) : '—' }),
    ]);
  }

  // ---------- Diálogo de tarea ----------

  const taskDialog = $('#task-dialog');
  const taskForm = $('#task-form');
  let editingId = null;

  function openTaskDialog(t, defaults, focusField) {
    editingId = t ? t.id : null;
    const f = taskForm.elements;

    f.assigneeId.replaceChildren(
      ...board().members.map((m) => el('option', { value: m.id, text: displayName(m) })),
      el('option', { value: '', text: 'Sin asignar' }),
    );
    f.status.replaceChildren(...STATUSES.map((s) => el('option', { value: s.id, text: s.name })));

    let defaultAssignee = me().id;
    if (filters.member && filters.member !== UNASSIGNED && ui.scope !== 'mine') defaultAssignee = filters.member;
    const values = Object.assign(
      { title: '', description: '', assigneeId: defaultAssignee, status: 'pendiente', priority: 'media', dueDate: '', blockedReason: '', urgent: false },
      defaults,
      t,
    );
    f.title.value = values.title;
    f.description.value = values.description;
    f.assigneeId.value = memberById(values.assigneeId) ? values.assigneeId : '';
    f.status.value = values.status;
    f.priority.value = values.priority;
    f.dueDate.value = values.dueDate;
    f.blockedReason.value = values.blockedReason || '';
    f.urgent.checked = !!values.urgent;
    syncBlockedReasonField();

    $('#task-dialog-title').textContent = t ? 'Editar tarea' : 'Nueva tarea · ' + BOARD_CONFIG[ui.activeBoard].title;
    $('#btn-delete-task').hidden = !t;
    taskDialog.showModal();
    f[focusField || 'title'].focus();
  }

  function syncBlockedReasonField() {
    $('#blocked-reason-field').hidden = taskForm.elements.status.value !== 'bloqueado';
    $('#urgent-field').hidden = !SPLIT_STATUSES.includes(taskForm.elements.status.value);
  }

  taskForm.elements.status.addEventListener('change', () => {
    syncBlockedReasonField();
    if (taskForm.elements.status.value === 'bloqueado') taskForm.elements.blockedReason.focus();
  });

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = taskForm.elements;
    const title = f.title.value.trim();
    if (!title) {
      f.title.focus();
      return;
    }
    const data = {
      title,
      description: f.description.value.trim(),
      assigneeId: f.assigneeId.value,
      status: f.status.value,
      priority: f.priority.value,
      dueDate: f.dueDate.value,
      urgent: f.urgent.checked,
      blockedReason: f.status.value === 'bloqueado' ? f.blockedReason.value.trim() : '',
      updatedAt: new Date().toISOString(),
    };
    const existing = editingId && board().tasks.find((x) => x.id === editingId);
    if (existing) {
      Object.assign(existing, data);
      persist(backend.updateTask(existing.id, data));
    } else {
      const created = Object.assign({ id: Store.uid(), createdAt: data.updatedAt }, data);
      board().tasks.push(created);
      persist(backend.insertTask(ui.activeBoard, created));
    }
    taskDialog.close();
    render();
  });

  $('#btn-delete-task').addEventListener('click', () => {
    const t = board().tasks.find((x) => x.id === editingId);
    if (!t || !confirm(`¿Eliminar la tarea "${t.title}"?`)) return;
    board().tasks = board().tasks.filter((x) => x.id !== t.id);
    persist(backend.deleteTask(t.id));
    taskDialog.close();
    render();
  });

  // ---------- Diálogo de miembros ----------

  const membersDialog = $('#members-dialog');

  function openMembersDialog() {
    const cfg = BOARD_CONFIG[ui.activeBoard];
    $('#members-dialog-title').textContent = cfg.membersLabel + ' · ' + cfg.title;
    $('#members-hint').textContent = cfg.membersHint;
    renderMemberList();
    membersDialog.showModal();
    $('#new-member-name').focus();
  }

  function renderMemberList() {
    $('#member-list').replaceChildren(...board().members.map((m) => {
      const taskCount = board().tasks.filter((t) => t.assigneeId === m.id).length;
      return el('li', { class: 'member-row' }, [
        avatar(m),
        el('input', {
          value: m.name,
          maxlength: '40',
          'aria-label': 'Nombre',
          onchange: (e) => {
            const name = e.target.value.trim();
            if (!name) { e.target.value = m.name; return; }
            if (name === m.name) return;
            m.name = name;
            persist(backend.updateMember(m.id, { name }));
            renderMemberList();
            render();
          },
        }),
        el('span', { class: 'member-meta', text: (m.isMe ? 'Tú · ' : '') + taskCount + (taskCount === 1 ? ' tarea' : ' tareas') }),
        m.isMe ? el('span', { class: 'icon-btn placeholder' }) : el('button', {
          class: 'icon-btn danger', type: 'button', title: 'Quitar a ' + m.name, 'aria-label': 'Quitar a ' + m.name,
          onclick: () => removeMember(m),
        }, ['✕']),
      ]);
    }));
  }

  function removeMember(m) {
    const count = board().tasks.filter((t) => t.assigneeId === m.id).length;
    const msg = count
      ? `¿Quitar a ${m.name}? Sus ${count} tareas quedarán sin asignar.`
      : `¿Quitar a ${m.name}?`;
    if (!confirm(msg)) return;
    board().members = board().members.filter((x) => x.id !== m.id);
    board().tasks.forEach((t) => { if (t.assigneeId === m.id) t.assigneeId = ''; });
    if (filters.member === m.id) filters.member = '';
    persist(backend.deleteMember(m.id));
    renderMemberList();
    render();
  }

  function addMember() {
    const input = $('#new-member-name');
    const name = input.value.trim();
    if (!name) return;
    const used = board().members.map((m) => m.color);
    const color = MEMBER_COLORS.find((c) => !used.includes(c)) || MEMBER_COLORS[board().members.length % MEMBER_COLORS.length];
    const member = { id: Store.uid(), name, color, isMe: false };
    board().members.push(member);
    input.value = '';
    persist(backend.insertMember(ui.activeBoard, member));
    renderMemberList();
    render();
    input.focus();
  }

  $('#btn-add-member').addEventListener('click', addMember);
  $('#new-member-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addMember(); }
  });

  // ---------- Eventos generales ----------

  $$('.board-tab').forEach((tab) => tab.addEventListener('click', () => {
    if (ui.activeBoard === tab.dataset.board) return;
    ui.activeBoard = tab.dataset.board;
    filters.member = '';
    Store.saveUI(ui);
    render();
  }));

  $$('#scope-filter button').forEach((b) => b.addEventListener('click', () => {
    ui.scope = b.dataset.scope;
    Store.saveUI(ui);
    render();
  }));

  $$('#view-switch button').forEach((b) => b.addEventListener('click', () => {
    ui.view = b.dataset.view;
    Store.saveUI(ui);
    render();
  }));

  $('#member-filter').addEventListener('change', (e) => { filters.member = e.target.value; render(); });
  $('#priority-filter').addEventListener('change', (e) => { filters.priority = e.target.value; render(); });
  $('#search').addEventListener('input', (e) => { filters.search = e.target.value; render(); });

  $('#btn-new-task').addEventListener('click', () => openTaskDialog(null));
  $('#btn-members').addEventListener('click', openMembersDialog);

  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'n' && boards && !$('#app-shell').hidden && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector('dialog[open]')
      && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      openTaskDialog(null);
    }
  });

  // ---------- Carga de datos ----------

  function showScreen(name) {
    $('#loading').hidden = name !== 'loading';
    $('#auth-screen').hidden = name !== 'auth';
    $('#app-shell').hidden = name !== 'app';
  }

  function showLoadError(err) {
    console.error(err);
    const box = $('#loading');
    box.replaceChildren(
      el('p', { text: 'No se han podido cargar tus tareas.' }),
      el('p', { class: 'hint', text: err && err.message ? err.message : String(err) }),
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, ['Reintentar']),
    );
    showScreen('loading');
  }

  async function startApp(user) {
    currentUser = user;
    $('#loading').textContent = 'Cargando tus tareas…';
    showScreen('loading');
    try {
      boards = await backend.loadBoards();
    } catch (err) {
      showLoadError(err);
      return;
    }
    // Si mientras tanto se abrió un enlace de cambio de contraseña, esperar a ese paso.
    if (recovering) return;
    $('#user-menu').hidden = !user;
    $('#user-email').textContent = user ? user.email : '';
    $('#local-banner').hidden = backend.mode !== 'local';
    showScreen('app');
    render();
  }

  // Vuelve a leer los datos (al volver a la pestaña o tras un error).
  let refreshing = false;
  async function refresh() {
    if (!boards || refreshing) return;
    refreshing = true;
    try {
      boards = await backend.loadBoards();
      render();
      if (!membersDialog.open) return;
      renderMemberList();
    } catch (err) {
      console.error(err);
    } finally {
      refreshing = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !taskDialog.open) refresh();
  });

  // ---------- Inicio de sesión ----------

  const authForm = $('#auth-form');
  let authMode = 'login';
  let recovering = false;

  const AUTH_MODES = {
    login: {
      title: 'Iniciar sesión', hint: 'Entra para ver tus tareas desde cualquier dispositivo.',
      submit: 'Entrar', password: 'Contraseña', switchText: '¿No tienes cuenta? Crear una', switchTo: 'signup',
    },
    signup: {
      title: 'Crear cuenta', hint: 'Tus tareas quedarán guardadas en tu cuenta.',
      submit: 'Crear cuenta', password: 'Contraseña (mínimo 6 caracteres)', switchText: '¿Ya tienes cuenta? Inicia sesión', switchTo: 'login',
    },
    reset: {
      title: 'Recuperar contraseña', hint: 'Te enviaremos un enlace para elegir una contraseña nueva.',
      submit: 'Enviar enlace', switchText: 'Volver a iniciar sesión', switchTo: 'login',
    },
    recovery: {
      title: 'Nueva contraseña', hint: 'Escribe la contraseña nueva para tu cuenta.',
      submit: 'Guardar contraseña', password: 'Nueva contraseña (mínimo 6 caracteres)',
    },
  };

  function showAuth(mode, message) {
    authMode = mode;
    const cfg = AUTH_MODES[mode];
    const f = authForm.elements;
    $('#auth-title').textContent = cfg.title;
    $('#auth-hint').textContent = cfg.hint;
    $('#auth-submit').textContent = cfg.submit;
    $('#auth-email-field').hidden = mode === 'recovery';
    $('#auth-password-field').hidden = !cfg.password;
    if (cfg.password) $('#auth-password-label').textContent = cfg.password;
    f.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    f.password.value = '';
    const signupAllowed = (window.APP_CONFIG.supabase || {}).allowSignup !== false;
    $('#auth-switch').hidden = !cfg.switchTo || (cfg.switchTo === 'signup' && !signupAllowed);
    $('#auth-switch').textContent = cfg.switchText || '';
    $('#auth-forgot').hidden = mode !== 'login';
    setAuthMessage(message || '');
    showScreen('auth');
    (mode === 'recovery' ? f.password : f.email).focus();
  }

  function setAuthMessage(text, ok) {
    const node = $('#auth-message');
    node.textContent = text;
    node.hidden = !text;
    node.classList.toggle('ok', !!ok);
  }

  function authErrorText(err) {
    const msg = (err && err.message) || '';
    if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
    if (/email not confirmed/i.test(msg)) return 'Tienes que confirmar tu email antes de entrar. Revisa tu correo.';
    if (/already registered|already exists/i.test(msg)) return 'Ya existe una cuenta con ese email.';
    if (/password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
    if (/failed to fetch|network/i.test(msg)) return 'No hay conexión con el servidor. Revisa tu conexión a internet.';
    return msg || 'Ha ocurrido un error. Inténtalo de nuevo.';
  }

  $('#auth-switch').addEventListener('click', () => showAuth(AUTH_MODES[authMode].switchTo));
  $('#auth-forgot').addEventListener('click', () => {
    const email = authForm.elements.email.value;
    showAuth('reset');
    authForm.elements.email.value = email;
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = authForm.elements;
    const email = f.email.value.trim();
    const password = f.password.value;
    if (authMode !== 'recovery' && !email) { setAuthMessage('Escribe tu email.'); f.email.focus(); return; }
    if (AUTH_MODES[authMode].password && password.length < 6) {
      setAuthMessage('La contraseña debe tener al menos 6 caracteres.');
      f.password.focus();
      return;
    }
    const button = $('#auth-submit');
    button.disabled = true;
    setAuthMessage('');
    try {
      if (authMode === 'login') {
        await backend.signIn(email, password);
      } else if (authMode === 'signup') {
        const { needsConfirmation } = await backend.signUp(email, password);
        if (needsConfirmation) {
          showAuth('login', '');
          f.email.value = email;
          setAuthMessage('Cuenta creada. Te hemos enviado un email: abre el enlace para confirmarla y después inicia sesión.', true);
        }
      } else if (authMode === 'reset') {
        await backend.resetPassword(email);
        setAuthMessage('Si existe una cuenta con ese email, recibirás un enlace para cambiar la contraseña.', true);
      } else if (authMode === 'recovery') {
        await backend.updatePassword(password);
        recovering = false;
        history.replaceState(null, '', location.pathname);
        startApp(await backend.getUser());
      }
    } catch (err) {
      setAuthMessage(authErrorText(err));
    } finally {
      button.disabled = false;
    }
  });

  $('#btn-logout').addEventListener('click', async () => {
    try {
      await backend.signOut();
    } catch (err) {
      console.error(err);
    }
    currentUser = null;
    boards = null;
    showAuth('login');
  });

  function handleAuthChange(event, user) {
    if (event === 'PASSWORD_RECOVERY') {
      recovering = true;
      showAuth('recovery');
      return;
    }
    if (recovering) return;
    if (user) {
      if (!currentUser || currentUser.id !== user.id) startApp(user);
    } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
      currentUser = null;
      boards = null;
      if (authMode === 'login' || $('#auth-screen').hidden) showAuth('login');
    }
  }

  try {
    backend = Store.createBackend();
  } catch (err) {
    showLoadError(err);
    return;
  }
  if (backend.mode === 'supabase') {
    // Supabase recomienda no llamar a otros métodos dentro del callback.
    backend.onAuthChange((event, user) => setTimeout(() => handleAuthChange(event, user), 0));
  } else {
    startApp(null);
  }
})();
