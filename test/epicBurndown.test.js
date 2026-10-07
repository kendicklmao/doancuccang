const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { buildEpicBurndown } = require('../helper/epicBurndown');

const DAY = 1000 * 60 * 60 * 24;
const START = new Date('2026-01-05T00:00:00.000Z');
const at = (days) => new Date(START.getTime() + days * DAY);
// now cố định: ngày 17 -> Week 3
const NOW = at(17);

const weekLabels = ['Start', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];
const actuals = (r) => r.weeks.map(w => w.actual);
const planneds = (r) => r.weeks.map(w => w.planned);

describe('buildEpicBurndown', () => {
    it('CASE 1: task chưa hoàn thành không làm giảm actual', () => {
        const r = buildEpicBurndown([
            { point: 6, status: 'pending', updatedAt: at(1), createdAt: at(0) },
            { point: 6, status: 'in-progress', completedAt: at(2), updatedAt: at(2) },
        ], START, NOW);
        assert.equal(r.totalPoints, 12);
        assert.equal(r.currentWeek, 3);
        assert.deepEqual(actuals(r), [12, 12, 12, 12, null, null, null]);
        assert.deepEqual(planneds(r), [12, 10, 8, 6, 4, 2, 0]);
    });

    it('CASE 2: task completed có completedAt -> tính theo completedAt', () => {
        const r = buildEpicBurndown([
            { point: 5, status: 'completed', completedAt: at(8), updatedAt: at(16), createdAt: at(0) },
            { point: 5, status: 'pending' },
        ], START, NOW);
        // completedAt ngày 8 -> Week 2 (updatedAt ngày 16 = Week 3 bị bỏ qua)
        assert.deepEqual(actuals(r), [10, 10, 5, 5, null, null, null]);
    });

    it('CASE 3: thiếu completedAt -> fallback updatedAt', () => {
        const r = buildEpicBurndown([
            { point: 4, status: 'completed', completedAt: null, updatedAt: at(15), createdAt: at(0) },
            { point: 4, status: 'pending' },
        ], START, NOW);
        assert.deepEqual(actuals(r), [8, 8, 8, 4, null, null, null]);
    });

    it('CASE 4: thiếu completedAt và updatedAt -> fallback createdAt', () => {
        const r = buildEpicBurndown([
            { point: 3, status: 'completed', createdAt: at(9) },
            { point: 3, status: 'pending' },
        ], START, NOW);
        assert.deepEqual(actuals(r), [6, 6, 3, 3, null, null, null]);
    });

    it('CASE 4b: không có ngày hợp lệ nào -> dồn về Week 1 (không mất điểm)', () => {
        const r = buildEpicBurndown([
            { point: 3, status: 'completed' },
            { point: 2, status: 'completed', completedAt: 'not-a-date', updatedAt: undefined, createdAt: null },
            { point: 5, status: 'pending' },
        ], START, NOW);
        assert.deepEqual(actuals(r), [10, 5, 5, 5, null, null, null]);
    });

    it('CASE 5: completed trước project start -> Week 1', () => {
        const r = buildEpicBurndown([
            { point: 7, status: 'completed', completedAt: at(-30) },
            { point: 3, status: 'pending' },
        ], START, NOW);
        assert.deepEqual(actuals(r), [10, 3, 3, 3, null, null, null]);
    });

    it('CASE 6: completed sau tuần 6 -> Week 6', () => {
        const now = at(100); // Week 15 thực tế, currentWeek cap 6
        const r = buildEpicBurndown([
            { point: 4, status: 'completed', completedAt: at(90) },
            { point: 2, status: 'completed', completedAt: at(3) },
            { point: 6, status: 'pending' },
        ], START, now);
        assert.equal(r.currentWeek, 6);
        assert.deepEqual(actuals(r), [12, 10, 10, 10, 10, 10, 6]);
    });

    it('CASE 7: task ở tuần hiện tại và tuần tương lai', () => {
        const r = buildEpicBurndown([
            { point: 2, status: 'completed', completedAt: at(16) }, // Week 3 (hiện tại)
            { point: 3, status: 'completed', completedAt: at(30) }, // Week 5 (tương lai, dữ liệu bất thường)
            { point: 5, status: 'pending' },
        ], START, NOW);
        assert.equal(r.currentWeek, 3);
        // Week 3 trừ 2 điểm; điểm Week 5 chưa được hiển thị vì tuần chưa tới
        assert.deepEqual(actuals(r), [10, 10, 10, 8, null, null, null]);
    });

    it('CASE 8: project không có task', () => {
        const r = buildEpicBurndown([], START, NOW);
        assert.equal(r.totalPoints, 0);
        assert.equal(r.currentWeek, 3);
        assert.deepEqual(planneds(r), [0, 0, 0, 0, 0, 0, 0]);
        assert.deepEqual(actuals(r), [0, 0, 0, 0, null, null, null]);
    });

    it('CASE 9: task point = 0', () => {
        const r = buildEpicBurndown([
            { point: 0, status: 'completed', completedAt: at(1) },
            { point: 0, status: 'pending' },
        ], START, NOW);
        assert.equal(r.totalPoints, 0);
        assert.deepEqual(actuals(r), [0, 0, 0, 0, null, null, null]);
    });

    it('CASE 10: task thiếu point / point null -> coi như 0', () => {
        const r = buildEpicBurndown([
            { status: 'completed', completedAt: at(1) },
            { point: null, status: 'completed', completedAt: at(1) },
            { point: 6, status: 'pending' },
        ], START, NOW);
        assert.equal(r.totalPoints, 6);
        assert.ok(r.weeks.every(w => w.actual === null || Number.isFinite(w.actual)));
        assert.deepEqual(actuals(r), [6, 6, 6, 6, null, null, null]);
    });

    it('CASE 11: luôn có đúng 7 phần tử Start + Week 1..6', () => {
        for (const now of [at(-10), at(0), NOW, at(500)]) {
            const r = buildEpicBurndown([{ point: 1, status: 'pending' }], START, now);
            assert.equal(r.weeks.length, 7);
            assert.deepEqual(r.weeks.map(w => w.week), weekLabels);
            r.weeks.forEach(w => assert.deepEqual(Object.keys(w).sort(), ['actual', 'planned', 'week']));
        }
        assert.deepEqual(Object.keys(buildEpicBurndown([], START, NOW)).sort(), ['currentWeek', 'totalPoints', 'weeks']);
    });

    it('CASE 12: future actual === null (không phải 0)', () => {
        const r = buildEpicBurndown([{ point: 6, status: 'completed', completedAt: at(1) }], START, NOW);
        // tất cả điểm đã xong nhưng tuần tương lai vẫn là null
        assert.deepEqual(actuals(r), [6, 0, 0, 0, null, null, null]);
        r.weeks.slice(4).forEach(w => assert.strictEqual(w.actual, null));
    });

    it('CASE 13: currentWeek không vượt quá 6', () => {
        assert.equal(buildEpicBurndown([], START, at(41)).currentWeek, 6); // Week 6
        assert.equal(buildEpicBurndown([], START, at(42)).currentWeek, 6); // Week 7 -> 6
        assert.equal(buildEpicBurndown([], START, at(3650)).currentWeek, 6);
    });

    it('K8: startDate tương lai -> currentWeek = 1 (behavior hiện tại, chỉ ghi nhận)', () => {
        const r = buildEpicBurndown([{ point: 6, status: 'pending' }], at(30), NOW);
        assert.equal(r.currentWeek, 1);
        assert.deepEqual(actuals(r), [6, 6, null, null, null, null, null]);
    });

    it('ranh giới tuần: ngày 0..6 = Week 1, ngày 7 = Week 2', () => {
        assert.equal(buildEpicBurndown([], START, at(6.99)).currentWeek, 1);
        assert.equal(buildEpicBurndown([], START, at(7)).currentWeek, 2);
    });

    it('không mutate input tasks', () => {
        const tasks = [{ point: 2, status: 'completed', completedAt: at(1) }];
        const copy = JSON.parse(JSON.stringify(tasks));
        buildEpicBurndown(tasks, START, NOW);
        assert.deepEqual(JSON.parse(JSON.stringify(tasks)), copy);
    });
});

describe('getEpicBurndown controller', () => {
    const Project = require('../model/project');
    const Task = require('../model/task');
    const controller = require('../controller/task');

    const originals = { findById: Project.findById, find: Task.find };
    afterEach(() => {
        Project.findById = originals.findById;
        Task.find = originals.find;
    });

    const mockRes = () => {
        const res = { statusCode: 200, body: undefined };
        res.status = (c) => { res.statusCode = c; return res; };
        res.json = (b) => { res.body = b; return res; };
        return res;
    };
    const chain = (value) => ({ select: async () => value });

    it('CASE 14: projectId hợp lệ nhưng project không tồn tại -> 404', async () => {
        let taskQueried = false;
        Project.findById = () => chain(null);
        Task.find = () => { taskQueried = true; return chain([]); };

        const res = mockRes();
        await controller.getEpicBurndown({ params: { projectId: new mongoose.Types.ObjectId().toString() } }, res);
        assert.equal(res.statusCode, 404);
        assert.deepEqual(res.body, { success: false, message: 'Project not found' });
        assert.equal(taskQueried, false);
    });

    it('projectId không hợp lệ -> 400 (giữ nguyên)', async () => {
        const res = mockRes();
        await controller.getEpicBurndown({ params: { projectId: 'abc' } }, res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { success: false, message: 'Invalid Project ID' });
    });

    it('project tồn tại -> 200 với contract {totalPoints,currentWeek,weeks}', async () => {
        Project.findById = () => chain({ startDate: new Date(Date.now() - 10 * DAY), createdAt: new Date(0) });
        Task.find = () => chain([
            { point: 4, status: 'completed', completedAt: new Date(Date.now() - 9 * DAY) },
            { point: 2, status: 'pending' },
        ]);
        const res = mockRes();
        await controller.getEpicBurndown({ params: { projectId: new mongoose.Types.ObjectId().toString() } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, undefined);
        assert.equal(res.body.totalPoints, 6);
        assert.equal(res.body.currentWeek, 2);
        assert.deepEqual(res.body.weeks.map(w => w.week), weekLabels);
        assert.deepEqual(actuals(res.body), [6, 2, 2, null, null, null, null]);
    });
});
