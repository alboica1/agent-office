import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MAX_MILESTONES, MAX_TASKS, MAX_TASK_TEXT, MAX_TITLE, cleanLine, cleanMilestones, moved, type Milestone, type MilestoneTask } from '../shared/milestones.js';

const newId = () => randomBytes(5).toString('hex');

/**
 * A floor's milestones board: its goals in order, each with a checklist of tasks, saved in
 * .agent-office/milestones.json. Each change answers with what it did, or a note saying why it
 * couldn't (someone else already deleted it, the board is full).
 */
export class Milestones {
  private items: Milestone[] = [];
  private file: string;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'milestones.json');
    this.load();
  }

  list(): Milestone[] {
    return this.items;
  }

  add(title: unknown): Milestone | string {
    if (this.items.length >= MAX_MILESTONES) return `The board is full (${MAX_MILESTONES} milestones). Delete one first.`;
    const t = cleanLine(title, MAX_TITLE);
    if (!t) return 'Give the milestone a title';
    const m: Milestone = { id: newId(), title: t, tasks: [] };
    this.items.push(m);
    this.save();
    return m;
  }

  rename(id: string, title: unknown): Milestone | string {
    const m = this.find(id);
    if (!m) return GONE;
    const t = cleanLine(title, MAX_TITLE);
    if (!t) return 'Give the milestone a title';
    if (t === m.title) return m;
    m.title = t;
    this.save();
    return m;
  }

  remove(id: string): Milestone | undefined {
    const i = this.items.findIndex((m) => m.id === id);
    if (i < 0) return undefined;
    const [m] = this.items.splice(i, 1);
    this.save();
    return m;
  }

  /** Moves milestone `id` to place `to` (clamped into the list). */
  move(id: string, to: unknown): Milestone | string {
    const from = this.items.findIndex((m) => m.id === id);
    if (from < 0) return GONE;
    if (typeof to !== 'number' || !Number.isFinite(to)) return 'Where to?';
    this.items = moved(this.items, from, to);
    this.save();
    return this.items.find((m) => m.id === id)!;
  }

  addTask(id: string, text: unknown): MilestoneTask | string {
    const m = this.find(id);
    if (!m) return GONE;
    if (m.tasks.length >= MAX_TASKS) return `That milestone is full (${MAX_TASKS} tasks). Delete one first.`;
    const t = cleanLine(text, MAX_TASK_TEXT);
    if (!t) return 'Write what the task is';
    const task: MilestoneTask = { id: newId(), text: t, done: false };
    m.tasks.push(task);
    this.save();
    return task;
  }

  editTask(id: string, taskId: string, text: unknown): MilestoneTask | string {
    const task = this.find(id)?.tasks.find((t) => t.id === taskId);
    if (!task) return TASK_GONE;
    const t = cleanLine(text, MAX_TASK_TEXT);
    if (!t) return 'Write what the task is';
    if (t === task.text) return task;
    task.text = t;
    this.save();
    return task;
  }

  removeTask(id: string, taskId: string): MilestoneTask | undefined {
    const m = this.find(id);
    const i = m?.tasks.findIndex((t) => t.id === taskId) ?? -1;
    if (!m || i < 0) return undefined;
    const [task] = m.tasks.splice(i, 1);
    this.save();
    return task;
  }

  /** Ticks a task off as done by `by` (or un-ticks it). */
  toggleTask(id: string, taskId: string, done: unknown, by: string): MilestoneTask | string {
    const m = this.find(id);
    const i = m?.tasks.findIndex((t) => t.id === taskId) ?? -1;
    if (!m || i < 0) return TASK_GONE;
    const old = m.tasks[i];
    const want = done === true;
    if (old.done === want) return old;
    m.tasks[i] = want ? { id: old.id, text: old.text, done: true, doneBy: by, doneAt: Date.now() } : { id: old.id, text: old.text, done: false };
    this.save();
    return m.tasks[i];
  }

  /** Moves a task to place `to` in its milestone's checklist. */
  moveTask(id: string, taskId: string, to: unknown): MilestoneTask | string {
    const m = this.find(id);
    const from = m?.tasks.findIndex((t) => t.id === taskId) ?? -1;
    if (!m || from < 0) return TASK_GONE;
    if (typeof to !== 'number' || !Number.isFinite(to)) return 'Where to?';
    m.tasks = moved(m.tasks, from, to);
    this.save();
    return m.tasks.find((t) => t.id === taskId)!;
  }

  private find(id: string): Milestone | undefined {
    return this.items.find((m) => m.id === id);
  }

  private load() {
    if (!existsSync(this.file)) return;
    try {
      this.items = cleanMilestones(JSON.parse(readFileSync(this.file, 'utf8')));
    } catch {
      // a broken file just means an empty board
    }
  }

  private save() {
    try {
      writeFileSync(this.file, JSON.stringify(this.items, null, 2), { mode: 0o600 });
    } catch {
      // disk issues shouldn't take the office down
    }
  }
}

const GONE = 'Someone already deleted that milestone';
const TASK_GONE = 'Someone already deleted that task';
