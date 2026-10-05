import type { Milestone } from '../../../shared/milestones';
import type { Slice } from '../store';

declare module '../store' {
  interface Store {
    /** The floor's milestones board: its goals in order, each with its checklist. */
    milestones: Milestone[];
  }
  interface Topics {
    milestones: true;
  }
}

export const milestones: Slice = {
  init(s) {
    s.milestones = [];
  },
  on: {
    milestones(s, m) {
      s.milestones = m.milestones;
      return ['milestones'];
    },
  },
  enter(s, v) {
    s.milestones = v.milestones;
    return ['milestones'];
  },
};
