// Epic Burndown: pure calculation, no DB / no Date.now() dependency
const TOTAL_WEEKS = 6;
const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

const toValidDate = (value) => {
    if (value === null || value === undefined) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

// Ngày hoàn thành: completedAt -> updatedAt -> createdAt (null nếu không có ngày hợp lệ)
const getCompletionDate = (task) =>
    toValidDate(task.completedAt) || toValidDate(task.updatedAt) || toValidDate(task.createdAt);

const clampWeek = (w) => Math.min(TOTAL_WEEKS, Math.max(1, w));

/**
 * @param {Array} tasks - [{ point, status, completedAt, updatedAt, createdAt }]
 * @param {Date|string|number} startDate - mốc bắt đầu project
 * @param {Date|string|number} now - thời điểm hiện tại (truyền vào để test deterministic)
 * @returns {{ totalPoints: number, currentWeek: number, weeks: Array<{week: string, planned: number, actual: number|null}> }}
 */
function buildEpicBurndown(tasks, startDate, now) {
    const list = Array.isArray(tasks) ? tasks : [];
    const start = toValidDate(startDate) || toValidDate(now) || new Date();
    const nowDate = toValidDate(now) || new Date();

    const weekOf = (d) => Math.floor((d - start) / WEEK_MS) + 1;

    const totalPoints = list.reduce((s, t) => s + Number(t.point || 0), 0);
    const currentWeek = Math.max(1, weekOf(nowDate));

    const doneByWeek = {};
    list.forEach(t => {
        if (t.status !== 'completed') return;
        const doneAt = getCompletionDate(t);
        // Không có ngày hợp lệ -> dồn về Week 1
        const w = doneAt ? clampWeek(weekOf(doneAt)) : 1;
        doneByWeek[w] = (doneByWeek[w] || 0) + Number(t.point || 0);
    });

    let remaining = totalPoints;
    // Điểm xuất phát: đường kế hoạch và thực tế cùng bắt đầu từ tổng points
    const weeks = [{ week: 'Start', planned: totalPoints, actual: totalPoints }];
    for (let w = 1; w <= TOTAL_WEEKS; w++) {
        const planned = Math.max(0, Math.round(totalPoints - (totalPoints / TOTAL_WEEKS) * w));
        let actual = null;
        if (w <= currentWeek) {
            remaining -= doneByWeek[w] || 0;
            actual = Math.max(0, remaining);
        }
        weeks.push({ week: `Week ${w}`, planned, actual });
    }

    return { totalPoints, currentWeek: Math.min(currentWeek, TOTAL_WEEKS), weeks };
}

module.exports = { buildEpicBurndown, getCompletionDate, TOTAL_WEEKS };
