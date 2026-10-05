// The milestones board on every floor: its goals in order, each with a checklist of tasks.

import type { Milestone } from '../milestones.js';

export type MilestonesClientMsg =
  /** A new milestone, at the end of the list. */
  | { t: 'milestone.add'; title: string }
  | { t: 'milestone.rename'; id: string; title: string }
  | { t: 'milestone.remove'; id: string }
  /** Move a milestone to place `to` in the list (0 is the first). */
  | { t: 'milestone.move'; id: string; to: number }
  /** A new task at the end of milestone `id`'s checklist. */
  | { t: 'milestone.task.add'; id: string; text: string }
  | { t: 'milestone.task.edit'; id: string; task: string; text: string }
  | { t: 'milestone.task.remove'; id: string; task: string }
  /** Tick a task off (or un-tick it). */
  | { t: 'milestone.task.toggle'; id: string; task: string; done: boolean }
  /** Move a task to place `to` in its milestone's checklist. */
  | { t: 'milestone.task.move'; id: string; task: string; to: number };

export type MilestonesServerMsg =
  /** Your floor's milestones changed: all of them, in order. */
  { t: 'milestones'; milestones: Milestone[] };
