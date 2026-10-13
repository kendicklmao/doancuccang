// On-Time Rate: pure calculation, no DB / no Date.now() dependency.
// Same rule as the weekly expectancy chart: a week is "on time" when the cumulative points completed
// by the end of that week (Real) >= the cumulative points planned up to that week (Plan).
// Only weeks that have already elapsed are counted. No elapsed week -> no rate (null), never a made-up 100.
const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * @param {Array} tasks - [{ point, week, columnId, createdAt, completedAt, completedDate }]
 * @param {string|null} doneColumnId - id of the project's Done column (null when the project has none)
 * @param {Date|string|number|null} fallbackStart - project.startDate, used only when no task has createdAt
 * @param {Date|string|number} now
 * @returns {{ evaluatedWeeks: number, onTimeWeeks: number }}
 */
function evaluateProjectWeeks(tasks, doneColumnId, fallbackStart, now) {
    const list = Array.isArray(tasks) ? tasks : [];
    if (list.length === 0) return { evaluatedWeeks: 0, onTimeWeeks: 0 };

    let minStart = null;
    let maxWeek = 1;
    for (const t of list) {
        if (t.createdAt) {
            const c = new Date(t.createdAt).getTime();
            if (!Number.isNaN(c) && (minStart === null || c < minStart)) minStart = c;
        }
        const w = Number(t.week || 1);
        if (w > maxWeek) maxWeek = w;
    }
    const startMs = minStart !== null ? minStart : new Date(fallbackStart).getTime();
    const nowMs = new Date(now).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(nowMs)) return { evaluatedWeeks: 0, onTimeWeeks: 0 };

    const currentWeek = Math.floor(Math.max(0, Math.floor((nowMs - startMs) / DAY_MS)) / 7) + 1;
    const weeksToEvaluate = Math.min(currentWeek, maxWeek);

    let onTimeWeeks = 0;
    for (let w = 1; w <= weeksToEvaluate; w++) {
        const weekEndMs = startMs + w * 7 * DAY_MS;
        const plan = list.filter(t => Number(t.week || 1) <= w).reduce((s, t) => s + Number(t.point || 0), 0);
        const real = list
            .filter(t => {
                const doneAt = t.completedDate || t.completedAt;
                if (!doneColumnId || String(t.columnId) !== doneColumnId || !doneAt) return false;
                return new Date(doneAt).getTime() <= weekEndMs;
            })
            .reduce((s, t) => s + Number(t.point || 0), 0);
        if (real >= plan) onTimeWeeks += 1;
    }
    return { evaluatedWeeks: weeksToEvaluate, onTimeWeeks };
}

/** @param {Array<{evaluatedWeeks:number,onTimeWeeks:number}>} results */
function summarizeOnTime(results) {
    const totalCompletedWeeks = results.reduce((s, r) => s + r.evaluatedWeeks, 0);
    const totalOnTimeWeeks = results.reduce((s, r) => s + r.onTimeWeeks, 0);
    return {
        totalCompletedWeeks,
        totalOnTimeWeeks,
        onTimeRate: totalCompletedWeeks > 0 ? Math.round((totalOnTimeWeeks / totalCompletedWeeks) * 100) : null,
    };
}

module.exports = { evaluateProjectWeeks, summarizeOnTime };
