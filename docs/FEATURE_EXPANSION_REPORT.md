# Feature Expansion Report — Backend (2026-10-10)

| Request | Status | Evidence |
|---|---|---|
| G Forgot password + email OTP | DONE in code, email delivery BLOCKED | `helper/otp.js`, `helper/passwordReset.js`, `helper/mailer.js`, `model/passwordReset.js`, `controller/user.js`, `route/user.js`; `test/passwordReset.test.js`: code generation, hashing, no code in responses, generic answer for unknown email, cooldown + hourly cap, mail failure -> no fake success, expiry, attempt limit, single use. No SMTP configured here: no real email was sent |
| H Change password | DONE (unit level) | same service; wrong current / short / same password refused; hash via bcrypt. HTTP + MongoDB: NOT RUN |
| C3 Delete only in Todo | DONE (rule unit-tested) | `helper/taskRules.js`, `controller/task.js` deleteTask returns 409; controller path against MongoDB: NOT RUN |
| B Timeline, A Invite, F Notifications | no backend change | existing `/note`, `/member/invite`; no notification API exists |

## Tests
`npm test`: 37 pass / 0 fail / 0 skip (26 before + 11 new). Syntax-checked `controller/user.js`, `controller/task.js`, `route/user.js`.

## Operator configuration (never commit values)
`SMTP_HOST`, `SMTP_PORT` (default 587; 465 = TLS), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, and a strong `OTP_SECRET` (and `JWT_SECRET`; the code has a weak default for JWT). No `.env.example` exists in the repo, so none was edited. New dependency: `nodemailer` (`package.json`).

## Security findings (not changed, outside scope)
- `PUT /api/user/:id` has no authentication: anyone can change any user's role, status or password. Recommend `verifyToken` + owner/Admin check.
- `POST /user/check-email` reveals whether an email has an account (token required).
- The retired `/user/reset-password` is now 410.
