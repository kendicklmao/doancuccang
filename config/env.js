require("dotenv").config();

module.exports = {
    port: process.env.PORT || 3000,
    mongoUrl: process.env.MONGO_URL,
    nodeEnv: process.env.NODE_ENV,

    // --- THÊM CẤU HÌNH SMTP & OTP VÀO ĐÂY ---
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    mailFrom: process.env.MAIL_FROM,
    otpSecret: process.env.OTP_SECRET,
    jwtSecret: process.env.JWT_SECRET
};