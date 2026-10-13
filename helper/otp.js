const crypto = require('crypto');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 60 * 1000; // 1 phút (60.000 ms)

// Cryptographically secure numeric code, generated on the server only
const generateOtp = () => String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

// Nhúng expiresAt vào hash để người dùng không tự sửa được thời gian
const hashOtp = (email, otp, expiresAt, secret) =>
    crypto.createHmac('sha256', secret)
        .update(`${String(email).toLowerCase()}:${otp}:${expiresAt}`)
        .digest('hex');

// Hàm tạo thông tin OTP hoàn chỉnh gửi về client/DB để lưu
const createOtpPayload = (email, secret) => {
    const otp = generateOtp();
    const expiresAt = Date.now() + OTP_TTL_MS;
    const hash = hashOtp(email, otp, expiresAt, secret);
    return { otp, hash, expiresAt };
};

const verifyOtpHash = (email, otp, expiresAt, expectedHash, secret) => {
    // 1. Kiểm tra định dạng đầu vào
    if (
        typeof otp !== 'string' ||
        !/^\d{6}$/.test(otp) ||
        typeof expectedHash !== 'string' ||
        typeof expiresAt !== 'number'
    ) {
        return false;
    }

    // 2. Kiểm tra xem OTP đã hết hạn (1 phút) chưa
    if (Date.now() > expiresAt) {
        return false; // OTP đã quá hạn
    }

    // 3. Tính lại HMAC với expiresAt và so sánh timing-safe
    const actualHash = hashOtp(email, otp, expiresAt, secret);
    const a = Buffer.from(actualHash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');

    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = {
    OTP_LENGTH,
    OTP_TTL_MS,
    generateOtp,
    hashOtp,
    createOtpPayload,
    verifyOtpHash,
};