// Forgot-password OTP flow. Dependencies are injected so the rules can be tested without MongoDB or SMTP.
const bcrypt = require('bcryptjs');
const { generateOtp, hashOtp, verifyOtpHash } = require('./otp');

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 6; // same rule as the User schema

const GENERIC_REQUEST_MESSAGE = 'If an account exists for this email, a verification code has been sent.';
const INVALID_CODE_MESSAGE = 'The verification code is invalid or has expired.';

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const isEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Step 1. Answers the same way whether the account exists or not (no account enumeration).
 * Returns { status, body }. Only a missing mail configuration is reported differently (it says nothing about the account).
 */
async function requestOtp({ email: rawEmail }, deps) {
    const { User, PasswordReset, sendMail, isMailConfigured, secret, now = () => new Date() } = deps;
    const email = normalizeEmail(rawEmail);
    if (!isEmail(email)) return { status: 400, body: { message: 'Please enter a valid email address.' } };
    if (!isMailConfigured()) return { status: 503, body: { message: 'Email service is not configured. Please contact the administrator.' } };

    const generic = { status: 200, body: { message: GENERIC_REQUEST_MESSAGE, resendAfterSeconds: RESEND_COOLDOWN_MS / 1000 } };
    const user = await User.findOne({ email });
    if (!user || user.status === 'Inactive') return generic;

    const time = now();
    const existing = await PasswordReset.findOne({ email });
    let windowStart = time;
    let sendCount = 1;
    if (existing) {
        if (time - existing.lastSentAt < RESEND_COOLDOWN_MS) return generic;
        if (time - existing.windowStart < 60 * 60 * 1000) {
            if (existing.sendCount >= MAX_SENDS_PER_HOUR) return generic;
            windowStart = existing.windowStart;
            sendCount = existing.sendCount + 1;
        }
    }

    const otp = generateOtp();
    await PasswordReset.findOneAndUpdate(
        { email },
        { email, otpHash: hashOtp(email, otp, secret), expiresAt: new Date(time.getTime() + OTP_TTL_MS), attempts: 0, lastSentAt: time, windowStart, sendCount },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    try {
        await sendMail({
            to: email,
            subject: 'Your TeamFlow password reset code',
            text: `Your verification code is ${otp}. It expires in ${OTP_TTL_MS / 60000} minutes. If you did not request it, ignore this email.`,
        });
    } catch (err) {
        // the code could not be delivered: drop it so the user can retry immediately
        await PasswordReset.deleteOne({ email });
        const e = new Error('MAIL_SEND_FAILED');
        e.cause = err;
        throw e;
    }
    return generic;
}

/** Step 2. Checks the code (expiry, attempts, single use) and sets the new password. */
async function verifyOtpAndReset({ email: rawEmail, otp, newPassword }, deps) {
    const { User, PasswordReset, secret, now = () => new Date() } = deps;
    const email = normalizeEmail(rawEmail);
    if (!isEmail(email) || typeof otp !== 'string' || typeof newPassword !== 'string') {
        return { status: 400, body: { message: 'Email, code and new password are required.' } };
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return { status: 400, body: { message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` } };
    }
    const invalid = { status: 400, body: { message: INVALID_CODE_MESSAGE } };

    const record = await PasswordReset.findOne({ email });
    if (!record || record.expiresAt <= now()) {
        if (record) await PasswordReset.deleteOne({ email });
        return invalid;
    }
    if (record.attempts >= MAX_ATTEMPTS) {
        await PasswordReset.deleteOne({ email });
        return { status: 429, body: { message: 'Too many attempts. Please request a new code.' } };
    }
    if (!verifyOtpHash(email, otp, record.otpHash, secret)) {
        await PasswordReset.updateOne({ email }, { $inc: { attempts: 1 } });
        return invalid;
    }
    const user = await User.findOne({ email });
    if (!user) {
        await PasswordReset.deleteOne({ email });
        return invalid;
    }
    const hashed = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await User.findByIdAndUpdate(user._id, { password: hashed });
    await PasswordReset.deleteOne({ email }); // single use
    return { status: 200, body: { message: 'Password reset successfully' } };
}

/** Logged-in change: the current password must match first. */
async function changePassword({ userId, currentPassword, newPassword }, { User }) {
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
        return { status: 400, body: { message: 'Current password and new password are required.' } };
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return { status: 400, body: { message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` } };
    }
    const user = await User.findById(userId);
    if (!user) return { status: 404, body: { message: 'User not found' } };
    if (!(await bcrypt.compare(currentPassword, user.password))) {
        return { status: 400, body: { message: 'Current password is incorrect.' } };
    }
    if (currentPassword === newPassword) {
        return { status: 400, body: { message: 'The new password must be different from the current password.' } };
    }
    await User.findByIdAndUpdate(user._id, { password: await bcrypt.hash(newPassword, await bcrypt.genSalt(10)) });
    return { status: 200, body: { message: 'Password changed successfully' } };
}

module.exports = {
    requestOtp, verifyOtpAndReset, changePassword,
    OTP_TTL_MS, RESEND_COOLDOWN_MS, MAX_SENDS_PER_HOUR, MAX_ATTEMPTS, GENERIC_REQUEST_MESSAGE, INVALID_CODE_MESSAGE,
};
