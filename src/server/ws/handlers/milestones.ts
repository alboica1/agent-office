// The milestones board on every floor: its goals in order, and their checklists.
import type { Floor } from '../../floor.js';
import type { MilestonesClientMsg } from '../../../shared/protocol.js';
import type { Ctx } from '../../office/context.js';
import type { Client } from '../../office/client.js';
import { str } from '../../office/input.js';
import { here } from './common.js';
import type { HandlerMap, ViewPieces } from './types.js';

export const milestonesView: ViewPieces['milestones'] = (_ctx, floor) => floor?.milestones.list() ?? [];
export const milestonesChanged = (ctx: Ctx, floor: Floor) => ctx.toFloor(floor, { t: 'milestones', milestones: floor.milestones.list() });

/** Sends everyone on the floor the board once `result` says it changed, or tells `c` why it didn't. */
function settle(ctx: Ctx, c: Client, floor: Floor, result: unknown) {
  if (typeof result === 'string') return ctx.warn(c, result);
  if (result) milestonesChanged(ctx, floor);
}

const id = (v: unknown) => str(v, 32);

export const milestonesHandlers = {
  'milestone.add'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (!floor) return;
    const m = floor.milestones.add(msg.title);
    settle(ctx, c, floor, m);
    if (typeof m !== 'string') ctx.toastFloor(floor, `🎯 ${c.peer.name} set a new milestone: “${m.title}”`);
  },
  'milestone.rename'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (floor) settle(ctx, c, floor, floor.milestones.rename(id(msg.id), msg.title));
  },
  'milestone.remove'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (!floor) return;
    const m = floor.milestones.remove(id(msg.id));
    settle(ctx, c, floor, m);
    if (m) ctx.toastFloor(floor, `${c.peer.name} deleted the milestone “${m.title}”`);
  },
  'milestone.move'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (floor) settle(ctx, c, floor, floor.milestones.move(id(msg.id), msg.to));
  },
  'milestone.task.add'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (floor) settle(ctx, c, floor, floor.milestones.addTask(id(msg.id), msg.text));
  },
  'milestone.task.edit'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (floor) settle(ctx, c, floor, floor.milestones.editTask(id(msg.id), id(msg.task), msg.text));
  },
  'milestone.task.remove'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (floor) settle(ctx, c, floor, floor.milestones.removeTask(id(msg.id), id(msg.task)));
  },
  'milestone.task.toggle'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (floor) settle(ctx, c, floor, floor.milestones.toggleTask(id(msg.id), id(msg.task), msg.done, c.peer.name));
  },
  'milestone.task.move'(ctx, c, msg) {
    const floor = here(ctx, c);
    if (floor) settle(ctx, c, floor, floor.milestones.moveTask(id(msg.id), id(msg.task), msg.to));
  },
} satisfies HandlerMap<MilestonesClientMsg>;
