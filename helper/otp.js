const crypto = require('crypto');

const OTP_LENGTH = 6;

// Cryptographically secure numeric code, generated on the server only
const generateOtp = () => String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

// HMAC bound to the email so a hash cannot be replayed for another account
const hashOtp = (email, otp, secret) =>
    crypto.createHmac('sha256', secret).update(`${String(email).toLowerCase()}:${otp}`).digest('hex');

const verifyOtpHash = (email, otp, expectedHash, secret) => {
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp) || typeof expectedHash !== 'string') return false;
    const a = Buffer.from(hashOtp(email, otp, secret), 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = { OTP_LENGTH, generateOtp, hashOtp, verifyOtpHash };
