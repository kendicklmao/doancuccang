# Dashboard QA Baseline (2026-10-10)

## Repositories checked
| Repo | Work branch | Base commit | Remote |
|---|---|---|---|
| Frontend `EprojectReactJs` | `qa/dashboard-sync` from `main` | `5580efa` | `origin` = KaSh02022/FinalProject1, `team` = QuachLoan/EprojectReactJs |
| Backend `doancuccang-backend` | `qa/dashboard-sync` from `origin/main` | `7ab7c6e` (local main was `e6bb088`, 6 behind, no local-only commits) | `origin` = kendicklmao/doancuccang |

- Fetch succeeded for all remotes. Frontend `team/main` = `4d12724`. **Frontend local and team have no common ancestor** (empty merge-base), so nothing was merged; the team ideas were already ported by hand in `5580efa`. Only file-level comparison is valid.
- Backend: two pre-existing untracked files (`BACKEND_FRONTEND_*.txt`) were left untouched.

## Baseline behaviour (before the fix)
- Dashboard (`Dasboard.jsx`) renders `KPI`, `PortfolioOverview`, `ProjectAnalytics`.
- `KPI` showed Total Projects and Total Budget only. On-Time Rate was hidden on purpose because `GET /project/portfolio` computed `status === "done"` tasks / all tasks, and `"done"` is never written (the app writes `"completed"`). The value was a placeholder.
- The workload table (`PortfolioOverview`, `teamWorkload()` in `utils/portfolioStats.js`) was built **only from task assignees**: no Role column, users with no task never appeared.
- `OverViews/TeamWorkload.jsx` is static sample data (hard-coded names/percentages) and is not rendered.

## Current charts / sections
Portfolio health (project progress, budget burn, plan adherence, Team workload table), Project analytics (Epic Burndown, Plan vs. Real progress).

## Charts removed on purpose (NOT restored)
Commit `223ae8a` removed `TodayTask`, `UCMDeadlines`, `RecentActivity`, `TaskCompletion`, static `TeamWorkload` and `ProjectStatus` from the Dashboard because they hold static sample data with no endpoint (see the comment in `Dasboard.jsx`). Files remain on disk, unused.

## Data lineage
| Figure | UI | API | Backend | Model |
|---|---|---|---|---|
| Total Projects / Budget | `KPI.jsx` | `GET /project/portfolio` | `controller/project.js` Portfolio (aggregate) | Project |
| On-Time Rate | `KPI.jsx` | same | `helper/onTimeRate.js` | Task (`week`, `point`, `columnId`, `completedDate/At`, `createdAt`), Column |
| Workload people + role | `PortfolioOverview.jsx` | `GET /member/project/:id`, `GET /task/project/:id` | `controller/member.js` getMembersByProject | Member (`role` Member/Leader/Manager, `status`), User |

## Findings
- On-Time Rate bug: wrong status value (`"done"`). A correct week-based formula already existed in `controller/task.js` Portfolio (Real >= Plan per elapsed week), but its route `/task/project/portfolio` is shadowed by `/task/project/:id`, so it was unreachable.
- Nested scroll: the shell has one intended scroll region (`.app-shell` 100vh hidden, `.page-content` overflow-y auto). With test data the Dashboard showed exactly one vertical scroller at 1366x768, 800x500 and 375x667. The team's original repro could **not** be reproduced; one latent cause was fixed (see plan).

## After the fix
See `DASHBOARD_SYNC_REPORT.md`.
