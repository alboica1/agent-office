// The milestones board on every floor: the floor's goals in order, each with a checklist of tasks.
// Pure code the server (keeping them) and the page (drawing them) both use.

export interface MilestoneTask {
  id: string;
  text: string;
  done: boolean;
  /** Who ticked it off, and when (ms), while it's done. */
  doneBy?: string;
  doneAt?: number;
}

export interface Milestone {
  id: string;
  title: string;
  tasks: MilestoneTask[];
}

/** The most milestones a floor keeps, and tasks a milestone has. */
export const MAX_MILESTONES = 30;
export const MAX_TASKS = 50;
/** The longest a milestone's title and a task's text may be, in characters. */
export const MAX_TITLE = 80;
export const MAX_TASK_TEXT = 200;

/** One tidy line of at most `max` characters: no control characters, no runs of spaces. */
export function cleanLine(text: unknown, max: number): string {
  if (typeof text !== 'string') return '';
  const flat = text.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return [...flat].slice(0, max).join('').trim();
}

/** How far along a milestone is. */
export function progress(m: Milestone): { done: number; total: number } {
  return { done: m.tasks.filter((t) => t.done).length, total: m.tasks.length };
}

/** Whether a milestone is finished: it has tasks, and every one is done. */
export const finished = (m: Milestone) => m.tasks.length > 0 && m.tasks.every((t) => t.done);

/** The milestone being worked toward: the first one in order that isn't finished. */
export function currentMilestone(list: readonly Milestone[]): Milestone | undefined {
  return list.find((m) => !finished(m));
}

/** `list` with the item at `from` moved to `to` (clamped into the list). */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, Math.trunc(to))), 0, item);
  return out;
}

/** A saved (or sent) list made safe: what isn't a milestone or a task is dropped, the rest tidied and capped. */
export function cleanMilestones(raw: unknown): Milestone[] {
  if (!Array.isArray(raw)) return [];
  const out: Milestone[] = [];
  const ids = new Set<string>();
  for (const r of raw) {
    if (out.length >= MAX_MILESTONES) break;
    if (!r || typeof r !== 'object') continue;
    const m = r as Record<string, unknown>;
    const title = cleanLine(m.title, MAX_TITLE);
    if (typeof m.id !== 'string' || !m.id || ids.has(m.id) || !title) continue;
    ids.add(m.id);
    const tasks: MilestoneTask[] = [];
    const taskIds = new Set<string>();
    for (const rt of Array.isArray(m.tasks) ? m.tasks : []) {
      if (tasks.length >= MAX_TASKS) break;
      if (!rt || typeof rt !== 'object') continue;
      const t = rt as Record<string, unknown>;
      const text = cleanLine(t.text, MAX_TASK_TEXT);
      if (typeof t.id !== 'string' || !t.id || taskIds.has(t.id) || !text) continue;
      taskIds.add(t.id);
      const done = t.done === true;
      tasks.push({ id: t.id.slice(0, 32), text, done, ...(done && typeof t.doneBy === 'string' ? { doneBy: t.doneBy.slice(0, 64) } : {}), ...(done && typeof t.doneAt === 'number' ? { doneAt: t.doneAt } : {}) });
    }
    out.push({ id: m.id.slice(0, 32), title, tasks });
  }
  return out;
}
