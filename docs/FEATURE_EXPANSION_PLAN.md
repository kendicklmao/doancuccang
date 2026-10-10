# Feature Expansion Plan — Backend (2026-10-10)

Branch `qa/dashboard-sync` (merged `origin/main` `a986e86` first; related history). Only what the frontend needs.

| Item | Current | Change |
|---|---|---|
| Forgot password | `POST /user/reset-password` (public) set any account's password from an email only; `POST /user/check-email` needs a token | New OTP flow, `/user/forgot-password/request` and `/verify`; old `/reset-password` answers 410 |
| Change password | none | `POST /user/change-password` [JWT] |
| Delete task | any task, for Manager | `DELETE /task/:id` allowed only when the task's column is Todo, else 409 |
| Timeline / milestones | project has `startDate` and `date` (end); notes = dated notes (`/note`) | none: reused as is |
| Notifications | no model, no route | none (frontend keeps the read state locally) |
| Invite | `POST /member/invite` one email | none |

## Contract
- `POST /api/user/forgot-password/request` `{ email }` -> 200 `{ message, resendAfterSeconds }` (same answer for unknown email), 400 invalid email, 503 mail not configured, 502 send failed.
- `POST /api/user/forgot-password/verify` `{ email, otp, newPassword }` -> 200, 400 invalid/expired code, 429 too many attempts.
- `POST /api/user/change-password` `{ currentPassword, newPassword }` (Bearer) -> 200, 400 wrong current / weak / same password.
- OTP: 6 digits from `crypto.randomInt`, stored only as HMAC-SHA256 (`OTP_SECRET`, falls back to the JWT secret), TTL 10 min, 5 attempts, 60 s resend cooldown, 5 sends/hour, single use, TTL index removes expired records.

## Tests
`node --test`: helper/service tests with in-memory fakes (no MongoDB, no SMTP). Real MongoDB / SMTP: not run.
