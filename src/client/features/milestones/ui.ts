import './ui.css';
// The 🎯 Milestones window: the floor's goals in order, each with its checklist. Everything in it is
// sent to the office, which tells everyone on the floor; the window redraws from what comes back.

import { MAX_MILESTONES, MAX_TASKS, MAX_TASK_TEXT, MAX_TITLE, currentMilestone, finished, progress, type Milestone, type MilestoneTask } from '../../../shared/milestones';
import type { Net } from '../../net';
import { store } from '../../state';
import { h, openModal, timeAgo, toast, type Modal } from '../../ui/dom';
import { confirmDialog } from '../../ui/prompt';

let open: Modal | null = null;

/** Opens the floor's milestones, to set its goals and tick off their tasks. */
export function openMilestones(net: Net) {
  if (open) return;
  const floor = store.floor;
  if (!floor) return toast('Take the elevator to a floor first', 'warn');
  /** The milestones whose checklists are showing; the current one to start with. */
  const expanded = new Set<string>();
  const now = currentMilestone(store.milestones);
  if (now) expanded.add(now.id);

  const summary = h('span.ms-summary');
  const close = h('button.btn.close', { type: 'button', 'aria-label': 'Close', title: 'Close (Esc)' }, '✕');
  const body = h('div.body.ms-body');
  const newTitle = h('input', { type: 'text', placeholder: 'A new milestone, like “Beta launch”', maxlength: MAX_TITLE, 'data-key': 'new-milestone', 'aria-label': 'New milestone title' });
  const addBtn = h('button.btn.primary', { type: 'button' }, '＋ Add milestone');
  const el = h(
    'div.modal.ms-window',
    { role: 'dialog', 'aria-label': 'Milestones' },
    h('header', {}, h('h2', {}, '🎯 Milestones'), summary, close),
    body,
    h('footer', {}, newTitle, addBtn),
  );

  const addMilestone = () => {
    const title = newTitle.value.trim();
    if (!title) return newTitle.focus();
    if (store.milestones.length >= MAX_MILESTONES) return toast(`The board is full (${MAX_MILESTONES} milestones). Delete one first.`, 'warn');
    net.send({ t: 'milestone.add', title });
    newTitle.value = '';
    newTitle.focus();
  };
  addBtn.addEventListener('click', addMilestone);
  newTitle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addMilestone();
  });

  /** A one-line text box that sends what's typed once you press Enter or leave it, unless it's empty or unchanged. */
  function editable(key: string, value: string, max: number, label: string, save: (text: string) => void) {
    const input = h('input', { type: 'text', value, maxlength: max, 'data-key': key, 'aria-label': label });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });
    input.addEventListener('change', () => {
      const text = input.value.trim();
      if (!text || text === value) {
        input.value = value;
        return;
      }
      save(text);
    });
    return input;
  }

  function taskRow(m: Milestone, t: MilestoneTask, i: number) {
    const box = h('input', { type: 'checkbox', 'aria-label': t.done ? 'Mark as not done' : 'Mark as done' });
    box.checked = t.done;
    box.addEventListener('change', () => net.send({ t: 'milestone.task.toggle', id: m.id, task: t.id, done: box.checked }));
    const text = editable(`task:${t.id}`, t.text, MAX_TASK_TEXT, 'Task', (v) => net.send({ t: 'milestone.task.edit', id: m.id, task: t.id, text: v }));
    const up = h('button.btn.ms-icon', { type: 'button', title: 'Move up', disabled: i === 0, onclick: () => net.send({ t: 'milestone.task.move', id: m.id, task: t.id, to: i - 1 }) }, '↑');
    const down = h('button.btn.ms-icon', { type: 'button', title: 'Move down', disabled: i === m.tasks.length - 1, onclick: () => net.send({ t: 'milestone.task.move', id: m.id, task: t.id, to: i + 1 }) }, '↓');
    const del = h('button.btn.ms-icon', { type: 'button', title: 'Delete task', onclick: () => net.send({ t: 'milestone.task.remove', id: m.id, task: t.id }) }, '🗑');
    const by = t.done && t.doneBy ? h('span.ms-by', { title: t.doneAt ? new Date(t.doneAt).toLocaleString() : '' }, `✓ ${t.doneBy}${t.doneAt ? ` · ${timeAgo(t.doneAt)}` : ''}`) : null;
    return h('li.ms-task', { class: t.done ? 'done' : '' }, box, text, by, up, down, del);
  }

  function milestoneCard(m: Milestone, i: number, list: readonly Milestone[], current: Milestone | undefined) {
    const { done, total } = progress(m);
    const isOpen = expanded.has(m.id);
    const toggle = h('button.btn.ms-icon', { type: 'button', title: isOpen ? 'Hide the checklist' : 'Show the checklist', 'aria-expanded': String(isOpen) }, isOpen ? '▾' : '▸');
    toggle.addEventListener('click', () => {
      if (expanded.has(m.id)) expanded.delete(m.id);
      else expanded.add(m.id);
      render();
    });
    const title = editable(`title:${m.id}`, m.title, MAX_TITLE, 'Milestone title', (v) => net.send({ t: 'milestone.rename', id: m.id, title: v }));
    const pct = total ? Math.round((done / total) * 100) : 0;
    const bar = h('span.ms-bar', { title: `${pct}%` }, h('span', { style: `width:${pct}%` }));
    const up = h('button.btn.ms-icon', { type: 'button', title: 'Move up', disabled: i === 0, onclick: () => net.send({ t: 'milestone.move', id: m.id, to: i - 1 }) }, '↑');
    const down = h('button.btn.ms-icon', { type: 'button', title: 'Move down', disabled: i === list.length - 1, onclick: () => net.send({ t: 'milestone.move', id: m.id, to: i + 1 }) }, '↓');
    const del = h('button.btn.ms-icon', { type: 'button', title: 'Delete milestone' }, '🗑');
    del.addEventListener('click', () =>
      confirmDialog('Delete this milestone?', `“${m.title}” and its ${total} task${total === 1 ? '' : 's'} go for everyone on the floor.`, 'Delete milestone', () => net.send({ t: 'milestone.remove', id: m.id })),
    );
    const badge = finished(m) ? h('span.ms-badge.reached', {}, 'Reached') : m === current ? h('span.ms-badge.current', {}, 'Current') : null;
    const head = h('div.ms-head', {}, toggle, h('span.ms-num', {}, `${i + 1}`), title, badge, h('span.ms-count', {}, `${done}/${total}`), bar, up, down, del);
    const card = h('li.ms-card', { class: [m === current ? 'current' : '', finished(m) ? 'reached' : ''].filter(Boolean).join(' ') }, head);
    if (isOpen) {
      const tasks = h('ul.ms-tasks', {}, ...m.tasks.map((t, j) => taskRow(m, t, j)));
      const newTask = h('input', { type: 'text', placeholder: m.tasks.length ? 'Another task…' : 'The first task…', maxlength: MAX_TASK_TEXT, 'data-key': `new-task:${m.id}`, 'aria-label': 'New task' });
      const addTask = () => {
        const text = newTask.value.trim();
        if (!text) return newTask.focus();
        if (m.tasks.length >= MAX_TASKS) return toast(`That milestone is full (${MAX_TASKS} tasks). Delete one first.`, 'warn');
        net.send({ t: 'milestone.task.add', id: m.id, text });
        newTask.value = '';
        newTask.focus();
      };
      newTask.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTask();
      });
      card.append(tasks, h('div.ms-add-task', {}, newTask, h('button.btn', { type: 'button', onclick: addTask }, '＋ Task')));
    }
    return card;
  }

  function render() {
    // Whatever you're typing in survives someone else's change coming in.
    const active = document.activeElement instanceof HTMLInputElement && el.contains(document.activeElement) && document.activeElement.type === 'text' ? document.activeElement : null;
    const keep = active ? { key: active.dataset.key, value: active.value, start: active.selectionStart, end: active.selectionEnd } : null;

    const list = store.milestones;
    const current = currentMilestone(list);
    const reached = list.filter(finished).length;
    summary.textContent = list.length ? `${reached} of ${list.length} reached` : '';
    if (!list.length) {
      body.replaceChildren(h('div.ms-empty', {}, h('p', {}, 'No milestones yet.'), h('p.note', {}, 'Set the floor’s goals in the order you’ll reach them, and give each a checklist of tasks. Everyone on the floor sees them here and on the board over the balcony doors.')));
    } else {
      body.replaceChildren(h('ul.ms-list', {}, ...list.map((m, i) => milestoneCard(m, i, list, current))));
    }
    if (keep?.key && keep.key !== 'new-milestone') {
      const again = el.querySelector<HTMLInputElement>(`input[data-key="${CSS.escape(keep.key)}"]`);
      if (again) {
        again.value = keep.value;
        again.focus();
        again.setSelectionRange(keep.start, keep.end);
      }
    }
  }

  const offs = [
    store.on('milestones', render),
    // Gone to another floor: these were the last one's.
    store.on('floor', () => {
      if (store.floor !== floor) modal.close();
    }),
  ];
  const modal = openModal(el, {
    doing: '🎯 at the milestones board',
    onClose: () => {
      offs.forEach((off) => off());
      open = null;
    },
  });
  open = modal;
  close.addEventListener('click', () => modal.close());
  render();
  setTimeout(() => (store.milestones.length ? undefined : newTitle.focus()), 30);
}
