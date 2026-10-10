const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateProjectWeeks, summarizeOnTime } = require('../helper/onTimeRate');

const DAY = 24 * 3600 * 1000;
const start = new Date('2026-01-01T00:00:00Z');
const at = (days) => new Date(start.getTime() + days * DAY);
const DONE = 'col-done';

test('no tasks -> nothing evaluated, rate is null (never 100)', () => {
    const r = evaluateProjectWeeks([], DONE, start, at(30));
    assert.deepEqual(r, { evaluatedWeeks: 0, onTimeWeeks: 0 });
    assert.equal(summarizeOnTime([r]).onTimeRate, null);
});

test('week on time when real >= plan; late week is not on time', () => {
    const tasks = [
        { point: 5, week: 1, columnId: DONE, createdAt: start, completedDate: at(3) },
        { point: 5, week: 2, columnId: 'col-todo', createdAt: start },
    ];
    // now = day 15 -> week 3 elapsed, maxWeek = 2 -> evaluate weeks 1..2
    const r = evaluateProjectWeeks(tasks, DONE, start, at(15));
    assert.deepEqual(r, { evaluatedWeeks: 2, onTimeWeeks: 1 });
    assert.equal(summarizeOnTime([r]).onTimeRate, 50);
});

test('only elapsed weeks count', () => {
    const tasks = [{ point: 5, week: 3, columnId: 'x', createdAt: start }];
    const r = evaluateProjectWeeks(tasks, DONE, start, at(2)); // still week 1
    assert.equal(r.evaluatedWeeks, 1);
});

test('done task without completion date does not count as real progress', () => {
    const tasks = [{ point: 4, week: 1, columnId: DONE, createdAt: start }];
    assert.equal(evaluateProjectWeeks(tasks, DONE, start, at(10)).onTimeWeeks, 0);
});

test('completion after week end is late; falls back to completedAt; no Done column -> nothing completed', () => {
    const late = [{ point: 4, week: 1, columnId: DONE, createdAt: start, completedAt: at(9) }];
    assert.equal(evaluateProjectWeeks(late, DONE, start, at(10)).onTimeWeeks, 0);
    const ok = [{ point: 4, week: 1, columnId: DONE, createdAt: start, completedAt: at(6) }];
    assert.equal(evaluateProjectWeeks(ok, DONE, start, at(10)).onTimeWeeks, 1);
    assert.equal(evaluateProjectWeeks(ok, null, start, at(10)).onTimeWeeks, 0);
});

test('summarize aggregates across projects', () => {
    const s = summarizeOnTime([{ evaluatedWeeks: 3, onTimeWeeks: 2 }, { evaluatedWeeks: 1, onTimeWeeks: 1 }]);
    assert.deepEqual(s, { totalCompletedWeeks: 4, totalOnTimeWeeks: 3, onTimeRate: 75 });
});
