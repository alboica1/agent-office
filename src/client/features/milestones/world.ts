import * as THREE from 'three';
import { FLOOR } from '../../../shared/layout';
import { currentMilestone, finished, progress, type Milestone } from '../../../shared/milestones';
import { textPlane } from '../../world/toon';
import { PALETTE } from '../../world/office/materials';
import { wallBoard } from '../../world/office/props';
import type { Fixture } from '../../world/office/fixture';
import type { Interactable } from '../../world/types';

// The milestones board: up on the south wall over the balcony doors, facing the desks, with the floor's
// goals in order on it, how far along each is, and the one being worked toward picked out.

/**
 * Where it hangs: centered `x` along the south wall, `y` up, between the bookshelf and the window east
 * of the balcony doors, high enough to clear the doors under it. It faces into the room (-z).
 */
export const MILESTONES_BOARD = { x: -3.05, y: 3.95, z: FLOOR.maxZ - 0.08, width: 4.4, height: 2.2 } as const;

const FONT = 'Nunito, ui-rounded, system-ui, sans-serif';
const INK = '#2b2d42';
const MUTED = '#6b7280';
const DONE = '#1e8f4e';
const NOW = '#e76f51';

export interface MilestonesBoard {
  /** Draws the milestones on the board (only when they changed). */
  render(list: readonly Milestone[]): void;
}

/** The board's face: a canvas the milestones are drawn on. */
class MilestonesTexture {
  readonly texture: THREE.CanvasTexture;
  private canvas = document.createElement('canvas');
  private g: CanvasRenderingContext2D;
  private drawn = '';

  constructor() {
    this.canvas.width = 1200;
    this.canvas.height = 600;
    this.g = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  render(list: readonly Milestone[]) {
    const key = JSON.stringify(list.map((m) => [m.title, progress(m)]));
    if (key === this.drawn) return;
    this.drawn = key;
    const { g } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    g.fillStyle = '#fbf8f1';
    g.fillRect(0, 0, W, H);
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = INK;
    g.font = `900 52px ${FONT}`;
    g.fillText('🎯 Milestones', 40, 76);
    const doneCount = list.filter(finished).length;
    g.textAlign = 'right';
    g.fillStyle = MUTED;
    g.font = `700 26px ${FONT}`;
    if (list.length) g.fillText(`${doneCount} of ${list.length} reached`, W - 40, 72);
    g.textAlign = 'left';
    g.fillStyle = '#e9e3d6';
    g.fillRect(40, 98, W - 80, 4);
    if (!list.length) {
      g.textAlign = 'center';
      g.fillStyle = INK;
      g.font = `900 50px ${FONT}`;
      g.fillText('No milestones yet', W / 2, H / 2 + 10);
      g.fillStyle = MUTED;
      g.font = `700 30px ${FONT}`;
      g.fillText('Walk up and press E to set the floor’s goals', W / 2, H / 2 + 62);
      this.texture.needsUpdate = true;
      return;
    }
    const current = currentMilestone(list);
    const shown = list.slice(0, 6);
    const rowH = Math.min(92, (H - 140) / shown.length);
    const fs = Math.round(rowH * 0.42);
    shown.forEach((m, i) => {
      const top = 118 + i * rowH;
      const { done, total } = progress(m);
      const isNow = m === current;
      const reached = finished(m);
      if (isNow) {
        g.fillStyle = 'rgba(231,111,81,.12)';
        roundRect(g, 28, top - 4, W - 56, rowH - 6, 14);
        g.fill();
        g.strokeStyle = NOW;
        g.lineWidth = 3;
        g.stroke();
      }
      const textY = top + fs + 6;
      g.fillStyle = reached ? DONE : isNow ? NOW : INK;
      g.font = `800 ${fs}px ${FONT}`;
      g.fillText(reached ? '✅' : isNow ? '▶' : `${i + 1}.`, 44, textY);
      // The count and the bar on the right; the title fills what's left.
      const barW = 260;
      const barX = W - 44 - barW;
      g.textAlign = 'right';
      g.font = `800 ${Math.round(fs * 0.85)}px ${FONT}`;
      g.fillStyle = reached ? DONE : MUTED;
      const count = `${done}/${total}`;
      g.fillText(count, barX - 18, textY);
      const countW = g.measureText(count).width;
      g.textAlign = 'left';
      g.font = `${isNow ? 900 : 800} ${fs}px ${FONT}`;
      g.fillStyle = reached ? DONE : INK;
      g.fillText(clip(g, m.title, barX - 18 - countW - 24 - 100), 100, textY);
      if (isNow) {
        g.fillStyle = NOW;
        g.font = `800 ${Math.round(fs * 0.6)}px ${FONT}`;
        g.fillText('CURRENT', 100, textY + Math.round(fs * 0.8));
      }
      const barY = textY - fs * 0.55;
      const barH = Math.max(12, fs * 0.5);
      g.fillStyle = '#e9e3d6';
      roundRect(g, barX, barY, barW, barH, barH / 2);
      g.fill();
      if (total && done) {
        g.fillStyle = reached ? DONE : isNow ? NOW : '#118ab2';
        roundRect(g, barX, barY, Math.max(barH, (barW * done) / total), barH, barH / 2);
        g.fill();
      }
    });
    if (list.length > shown.length) {
      g.fillStyle = MUTED;
      g.font = `800 24px ${FONT}`;
      g.textAlign = 'right';
      g.fillText(`+${list.length - shown.length} more`, W - 44, H - 18);
      g.textAlign = 'left';
    }
    this.texture.needsUpdate = true;
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function clip(g: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (g.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && g.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

declare module '../../world/types' {
  interface OfficeHandles {
    /** The milestones board over the balcony doors. */
    milestonesBoard: MilestonesBoard;
  }
}

/** The milestones board, on the south wall over the balcony doors, in a wooden frame like the other boards. */
export const milestonesBoard: Fixture<'milestonesBoard'> = (site) => {
  const b = MILESTONES_BOARD;
  const rotY = Math.PI;
  const { group, face } = wallBoard(b.width, b.height, PALETTE.wood);
  group.position.set(b.x, b.y, b.z - 0.08);
  group.rotation.y = rotY;
  const tex = new MilestonesTexture();
  (face.material as THREE.MeshBasicMaterial).map = tex.texture;
  (face.material as THREE.MeshBasicMaterial).needsUpdate = true;
  tex.render([]);
  const label = textPlane('🎯 Milestones', { bg: '#fffaf3', size: 64 });
  label.scale.multiplyScalar(1.1);
  label.position.set(b.x, b.y + b.height / 2 + 0.45, b.z - 0.04);
  label.rotation.y = rotY;
  const it: Interactable = { kind: 'milestones', x: b.x, z: b.z - 1.6, radius: 2 };
  // The board and its label above it, so pictures don't hang over them.
  site.wall('south', b.x, b.y + 0.3, b.width + 0.3, b.height + 1.2);
  const all = new THREE.Group();
  all.add(group, label);
  // Aiming at the board or the sign over it is aiming at it.
  all.userData.interact = it;
  return { group: all, interactables: [it], handle: { milestonesBoard: { render: (list) => tex.render(list) } } };
};
