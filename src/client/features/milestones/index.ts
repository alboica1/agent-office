/** The milestones board: the floor's goals on the wall over the balcony doors, and E to set them and tick off their tasks. */
import { currentMilestone, progress } from '../../../shared/milestones';
import type { Ctx } from '../../core/context';
import { aside, hintTitle, key, onE } from '../../core/hint';
import { store } from '../../state';
import { clip } from '../../ui/dom';
import { openMilestones } from './ui';

// The kinds of thing you can use that this defines (see InteractKinds in world/types.ts).
declare module '../../world/types' {
  interface InteractKinds {
    milestones: true;
  }
}

export function installMilestones(ctx: Ctx) {
  const board = ctx.office.milestonesBoard;
  // The board shows the floor's milestones as they change.
  const draw = () => board.render(store.milestones);
  store.on('milestones', draw);
  draw();
  ctx.interactions.define('milestones', {
    reach: 8,
    hint: () => {
      const now = currentMilestone(store.milestones);
      const p = now && progress(now);
      const what = now && p ? `now: ${clip(now.title, 40)} · ${p.done}/${p.total}` : store.milestones.length ? 'every milestone reached 🎉' : 'set the floor’s goals';
      return { k: what, parts: [hintTitle('🎯 Milestones'), aside(what), key('E', 'Open')] };
    },
    use: onE(() => openMilestones(ctx.net)),
  });
}
