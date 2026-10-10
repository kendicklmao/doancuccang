// Rules tested with in-memory fakes (no MongoDB, no SMTP). They prove the logic, not the real database / mail server.
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { generateOtp, hashOtp, verifyOtpHash } = require('../helper/otp');
const { isTodoColumnTitle } = require('../helper/taskRules');
const { isMailConfigured, sendMail, MailNotConfiguredError } = require('../helper/mailer');
const svc = require('../helper/passwordReset');

const SECRET = 'test-secret';

function makeWorld({ mailConfigured = true, sendFails = false } = {}) {
    const users = [{ _id: 'u1', email: 'ann@test.invalid', status: 'Active', password: bcrypt.hashSync('oldpass1', 4) }];
    const resets = new Map();
    const sent = [];
    let clock = new Date('2026-01-01T10:00:00Z');
    const User = {
        findOne: async ({ email }) => users.find((u) => u.email === email) || null,
        findById: async (id) => users.find((u) => u._id === id) || null,
        findByIdAndUpdate: async (id, patch) => Object.assign(users.find((u) => u._id === id), patch),
    };
    const PasswordReset = {
        findOne: async ({ email }) => resets.get(email) || null,
        findOneAndUpdate: async ({ email }, doc) => { resets.set(email, { ...doc }); },
        deleteOne: async ({ email }) => { resets.delete(email); },
        updateOne: async ({ email }, upd) => { const r = resets.get(email); if (r && upd.$inc) r.attempts += upd.$inc.attempts; },
    };
    const sendMailFake = async (mail) => { if (sendFails) throw new Error('smtp down'); sent.push(mail); };
    const deps = { User, PasswordReset, sendMail: sendMailFake, isMailConfigured: () => mailConfigured, secret: SECRET, now: () => clock };
    const lastOtp = () => /(\d{6})/.exec(sent[sent.length - 1].text)[1];
    return { users, resets, sent, deps, lastOtp, advance: (ms) => { clock = new Date(clock.getTime() + ms); } };
}

test('otp: 6 digits, server side, hashed (never stored plain), bound to the email', () => {
    for (let i = 0; i < 50; i++) assert.match(generateOtp(), /^\d{6}$/);
    const h = hashOtp('a@x.test', '123456', SECRET);
    assert.ok(!h.includes('123456'));
    assert.ok(verifyOtpHash('a@x.test', '123456', h, SECRET));
    assert.ok(!verifyOtpHash('b@x.test', '123456', h, SECRET));
    assert.ok(!verifyOtpHash('a@x.test', '654321', h, SECRET));
    assert.ok(!verifyOtpHash('a@x.test', 'abcdef', h, SECRET));
});

test('request: sends the code, answers generically, response never contains the code', async () => {
    const w = makeWorld();
    const r = await svc.requestOtp({ email: 'Ann@Test.invalid' }, w.deps);
    assert.equal(r.status, 200);
    assert.equal(w.sent.length, 1);
    assert.ok(!JSON.stringify(r.body).includes(w.lastOtp()));
    assert.ok(!JSON.stringify([...w.resets.values()]).includes(w.lastOtp()));
});

test('request: unknown email gives the same answer and sends nothing (no enumeration)', async () => {
    const w = makeWorld();
    const known = await svc.requestOtp({ email: 'ann@test.invalid' }, w.deps);
    const unknown = await svc.requestOtp({ email: 'nobody@test.invalid' }, w.deps);
    assert.deepEqual(unknown, known);
    assert.equal(w.sent.length, 1);
});

test('request: invalid email -> 400; mail not configured -> 503 and nothing stored', async () => {
    const w = makeWorld({ mailConfigured: false });
    assert.equal((await svc.requestOtp({ email: 'nope' }, w.deps)).status, 400);
    assert.equal((await svc.requestOtp({ email: 'ann@test.invalid' }, w.deps)).status, 503);
    assert.equal(w.resets.size, 0);
});

test('request: resend cooldown and hourly cap', async () => {
    const w = makeWorld();
    await svc.requestOtp({ email: 'ann@test.invalid' }, w.deps);
    await svc.requestOtp({ email: 'ann@test.invalid' }, w.deps); // inside cooldown
    assert.equal(w.sent.length, 1);
    for (let i = 0; i < 6; i++) { w.advance(svc.RESEND_COOLDOWN_MS + 1000); await svc.requestOtp({ email: 'ann@test.invalid' }, w.deps); }
    assert.equal(w.sent.length, svc.MAX_SENDS_PER_HOUR);
});

test('request: mail failure drops the code and surfaces an error (never a fake success)', async () => {
    const w = makeWorld({ sendFails: true });
    await assert.rejects(svc.requestOtp({ email: 'ann@test.invalid' }, w.deps), /MAIL_SEND_FAILED/);
    assert.equal(w.resets.size, 0);
});

test('verify: correct code resets the password (bcrypt) and cannot be reused', async () => {
    const w = makeWorld();
    await svc.requestOtp({ email: 'ann@test.invalid' }, w.deps);
    const otp = w.lastOtp();
    const ok = await svc.verifyOtpAndReset({ email: 'ann@test.invalid', otp, newPassword: 'newpass1' }, w.deps);
    assert.equal(ok.status, 200);
    assert.ok(await bcrypt.compare('newpass1', w.users[0].password));
    const again = await svc.verifyOtpAndReset({ email: 'ann@test.invalid', otp, newPassword: 'another1' }, w.deps);
    assert.equal(again.status, 400);
    assert.ok(await bcrypt.compare('newpass1', w.users[0].password));
});

test('verify: wrong code, expired code, attempts limit, short password', async () => {
    const w = makeWorld();
    await svc.requestOtp({ email: 'ann@test.invalid' }, w.deps);
    const otp = w.lastOtp();
    const wrong = otp === '000000' ? '111111' : '000000';
    assert.equal((await svc.verifyOtpAndReset({ email: 'ann@test.invalid', otp: wrong, newPassword: 'newpass1' }, w.deps)).status, 400);
    assert.equal((await svc.verifyOtpAndReset({ email: 'ann@test.invalid', otp, newPassword: '123' }, w.deps)).status, 400);
    for (let i = 0; i < svc.MAX_ATTEMPTS; i++) await svc.verifyOtpAndReset({ email: 'ann@test.invalid', otp: wrong, newPassword: 'newpass1' }, w.deps);
    // the right code no longer works once the attempts are used up
    const locked = await svc.verifyOtpAndReset({ email: 'ann@test.invalid', otp, newPassword: 'newpass1' }, w.deps);
    assert.ok([400, 429].includes(locked.status));
    assert.equal(w.resets.size, 0); // the code is discarded: a new one has to be requested
    assert.ok(await bcrypt.compare('oldpass1', w.users[0].password));

    const w2 = makeWorld();
    await svc.requestOtp({ email: 'ann@test.invalid' }, w2.deps);
    const otp2 = w2.lastOtp();
    w2.advance(svc.OTP_TTL_MS + 1000);
    assert.equal((await svc.verifyOtpAndReset({ email: 'ann@test.invalid', otp: otp2, newPassword: 'newpass1' }, w2.deps)).status, 400);
});

test('change password: needs the current password, a valid and different new one', async () => {
    const w = makeWorld();
    const base = { userId: 'u1' };
    assert.equal((await svc.changePassword({ ...base, currentPassword: 'bad', newPassword: 'newpass1' }, w.deps)).status, 400);
    assert.equal((await svc.changePassword({ ...base, currentPassword: 'oldpass1', newPassword: '123' }, w.deps)).status, 400);
    assert.equal((await svc.changePassword({ ...base, currentPassword: 'oldpass1', newPassword: 'oldpass1' }, w.deps)).status, 400);
    assert.equal((await svc.changePassword({ ...base, currentPassword: '', newPassword: 'newpass1' }, w.deps)).status, 400);
    assert.equal((await svc.changePassword({ userId: 'nope', currentPassword: 'oldpass1', newPassword: 'newpass1' }, w.deps)).status, 404);
    assert.ok(await bcrypt.compare('oldpass1', w.users[0].password)); // nothing changed so far
    const ok = await svc.changePassword({ ...base, currentPassword: 'oldpass1', newPassword: 'newpass1' }, w.deps);
    assert.equal(ok.status, 200);
    assert.ok(await bcrypt.compare('newpass1', w.users[0].password));
});

test('mailer: refuses to send without configuration, uses env credentials when present', async () => {
    assert.equal(isMailConfigured({}), false);
    await assert.rejects(sendMail({ to: 'a@x.test', subject: 's', text: 't' }, {}), MailNotConfiguredError);
    const env = { SMTP_HOST: 'smtp.test.invalid', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'no-reply@test.invalid', SMTP_PORT: '465' };
    let cfg; let mail;
    await sendMail({ to: 'a@x.test', subject: 's', text: 't' }, env, (c) => { cfg = c; return { sendMail: async (m) => { mail = m; } }; });
    assert.equal(cfg.host, 'smtp.test.invalid');
    assert.equal(cfg.secure, true);
    assert.equal(mail.from, 'no-reply@test.invalid');
});

test('task delete rule: only the Todo column title qualifies', () => {
    for (const t of ['Todo', 'todo', 'To Do', ' TO DO ', 'To-do']) assert.equal(isTodoColumnTitle(t), true, t);
    for (const t of ['In Progress', 'Done', 'Review', 'Backlog', '', null, undefined, 'Todos']) assert.equal(isTodoColumnTitle(t), false, String(t));
});
