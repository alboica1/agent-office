import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Milestones } from '../src/server/milestones.js';
import { MAX_MILESTONES, MAX_TASKS, MAX_TASK_TEXT, MAX_TITLE, cleanLine, cleanMilestones, currentMilestone, moved, progress, type Milestone } from '../src/shared/milestones.js';

function withDir(fn: (dir: string) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), 'agent-office-milestones-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const made = <T>(v: T | string): T => {
  assert.notEqual(typeof v, 'string', String(v));
  return v as T;
};
const titles = (ms: Milestones) => ms.list().map((m) => m.title);

test('milestones are added in order, renamed and deleted, and stay across restarts', () => {
  withDir((dir) => {
    const ms = new Milestones(dir);
    const alpha = made(ms.add('  Alpha   release '));
    made(ms.add('Beta'));
    assert.deepEqual(titles(ms), ['Alpha release', 'Beta']);
    assert.deepEqual(alpha.tasks, []);
    assert.equal(made(ms.rename(alpha.id, 'Alpha\nlaunch')).title, 'Alpha launch');
    assert.deepEqual(titles(new Milestones(dir)), ['Alpha launch', 'Beta']);
    assert.equal(ms.remove(alpha.id)?.title, 'Alpha launch');
    assert.equal(ms.remove(alpha.id), undefined);
    assert.deepEqual(titles(new Milestones(dir)), ['Beta']);
    assert.ok(readFileSync(path.join(dir, 'milestones.json'), 'utf8').includes('"Beta"'));
  });
});

test('titles and task texts are checked and capped, and so is how many there are', () => {
  withDir((dir) => {
    const ms = new Milestones(dir);
    assert.equal(typeof ms.add('   '), 'string');
    assert.equal(typeof ms.add(42), 'string');
    const long = made(ms.add('x'.repeat(500)));
    assert.equal(long.title.length, MAX_TITLE);
    assert.equal(typeof ms.rename(long.id, ''), 'string');
    assert.equal(typeof ms.rename('nope', 'Hi'), 'string');
    const task = made(ms.addTask(long.id, 'y'.repeat(1000)));
    assert.equal(task.text.length, MAX_TASK_TEXT);
    assert.equal(typeof ms.addTask(long.id, ' \t '), 'string');
    assert.equal(typeof ms.addTask('nope', 'Do it'), 'string');
    for (let i = 1; i < MAX_TASKS; i++) made(ms.addTask(long.id, `Task ${i}`));
    assert.match(String(ms.addTask(long.id, 'One too many')), /full/);
    for (let i = 1; i < MAX_MILESTONES; i++) made(ms.add(`M${i}`));
    assert.match(String(ms.add('One too many')), /full/);
    assert.equal(ms.list().length, MAX_MILESTONES);
  });
});

test('milestones move up, down and to a place, clamped into the list', () => {
  withDir((dir) => {
    const ms = new Milestones(dir);
    const [a, b, c] = ['A', 'B', 'C'].map((t) => made(ms.add(t)));
    made(ms.move(c.id, 0));
    assert.deepEqual(titles(ms), ['C', 'A', 'B']);
    made(ms.move(c.id, 1));
    assert.deepEqual(titles(ms), ['A', 'C', 'B']);
    made(ms.move(a.id, 99));
    assert.deepEqual(titles(ms), ['C', 'B', 'A']);
    made(ms.move(b.id, -5));
    assert.deepEqual(titles(ms), ['B', 'C', 'A']);
    assert.equal(typeof ms.move(b.id, 'up'), 'string');
    assert.equal(typeof ms.move(b.id, NaN), 'string');
    assert.equal(typeof ms.move('nope', 0), 'string');
    assert.deepEqual(titles(new Milestones(dir)), ['B', 'C', 'A']);
  });
});

test('tasks are added, edited, reordered, ticked off by someone and deleted', () => {
  withDir((dir) => {
    const ms = new Milestones(dir);
    const m = made(ms.add('Launch'));
    const [t1, t2, t3] = ['Write docs', 'Fix bugs', 'Ship'].map((t) => made(ms.addTask(m.id, t)));
    assert.equal(made(ms.editTask(m.id, t2.id, 'Fix the bugs')).text, 'Fix the bugs');
    assert.equal(typeof ms.editTask(m.id, 'nope', 'x'), 'string');
    made(ms.moveTask(m.id, t3.id, 0));
    assert.deepEqual(ms.list()[0].tasks.map((t) => t.text), ['Ship', 'Write docs', 'Fix the bugs']);

    const before = Date.now();
    const done = made(ms.toggleTask(m.id, t1.id, true, 'Ada'));
    assert.equal(done.done, true);
    assert.equal(done.doneBy, 'Ada');
    assert.ok(done.doneAt! >= before);
    // Ticking it again changes nothing: it's still Ada's.
    assert.equal(made(ms.toggleTask(m.id, t1.id, true, 'Bo')).doneBy, 'Ada');
    assert.deepEqual(progress(ms.list()[0]), { done: 1, total: 3 });
    // Across a restart, who ticked it off comes too.
    assert.equal(new Milestones(dir).list()[0].tasks.find((t) => t.id === t1.id)?.doneBy, 'Ada');
    const undone = made(ms.toggleTask(m.id, t1.id, false, 'Bo'));
    assert.deepEqual(undone, { id: t1.id, text: 'Write docs', done: false });
    // Only `true` ticks it off.
    assert.equal(made(ms.toggleTask(m.id, t1.id, 'yes', 'Bo')).done, false);
    assert.equal(typeof ms.toggleTask(m.id, 'nope', true, 'Bo'), 'string');

    assert.equal(ms.removeTask(m.id, t2.id)?.text, 'Fix the bugs');
    assert.equal(ms.removeTask(m.id, t2.id), undefined);
    assert.deepEqual(new Milestones(dir).list()[0].tasks.map((t) => t.text), ['Ship', 'Write docs']);
  });
});

test('the current milestone is the first one not finished; one with no tasks is not finished', () => {
  const ms = (title: string, done: boolean[]): Milestone => ({ id: title, title, tasks: done.map((d, i) => ({ id: `${i}`, text: `${i}`, done: d })) });
  assert.equal(currentMilestone([]), undefined);
  assert.equal(currentMilestone([ms('A', [true, true]), ms('B', [true, false]), ms('C', [])])?.title, 'B');
  assert.equal(currentMilestone([ms('A', [true]), ms('B', [])])?.title, 'B');
  assert.equal(currentMilestone([ms('A', [true]), ms('B', [true])]), undefined);
});

test('a broken or tampered file loads what it can', () => {
  withDir((dir) => {
    writeFileSync(path.join(dir, 'milestones.json'), '{nope');
    assert.deepEqual(new Milestones(dir).list(), []);
    writeFileSync(
      path.join(dir, 'milestones.json'),
      JSON.stringify([
        { id: 'a', title: 'Good', tasks: [{ id: 't', text: 'ok', done: true, doneBy: 'Ada', doneAt: 5 }, { id: 't', text: 'same id' }, { text: 'no id' }, { id: 'u', text: 'not done', done: false, doneBy: 'Ada' }] },
        { id: 'a', title: 'Same id' },
        { id: 'b', title: '' },
        'junk',
        { id: 'c', title: 'No tasks', tasks: 'nope' },
      ]),
    );
    assert.deepEqual(new Milestones(dir).list(), [
      { id: 'a', title: 'Good', tasks: [{ id: 't', text: 'ok', done: true, doneBy: 'Ada', doneAt: 5 }, { id: 'u', text: 'not done', done: false }] },
      { id: 'c', title: 'No tasks', tasks: [] },
    ]);
  });
  assert.deepEqual(cleanMilestones({}), []);
  assert.equal(cleanMilestones(Array.from({ length: MAX_MILESTONES + 5 }, (_, i) => ({ id: `${i}`, title: `M${i}` }))).length, MAX_MILESTONES);
});

test('lines are tidied and cut on whole characters', () => {
  assert.equal(cleanLine(`a\nb\tc${String.fromCharCode(7)}d${String.fromCharCode(0x2028)}e`, 50), 'a b c d e');
  assert.equal([...cleanLine('🚀'.repeat(100), MAX_TITLE)].length, MAX_TITLE);
  assert.equal(cleanLine(undefined, 10), '');
  assert.deepEqual(moved(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(moved(['a', 'b', 'c'], 5, 0), ['a', 'b', 'c']);
});
