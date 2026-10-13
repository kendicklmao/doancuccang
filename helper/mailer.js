const nodemailer = require('nodemailer');

class MailNotConfiguredError extends Error {
    constructor() {
        super('Email service is not configured');
        this.code = 'MAIL_NOT_CONFIGURED';
    }
}

// Kiểm tra xem cấu hình SMTP có hợp lệ hay không
const isMailConfigured = (env = process.env) =>
    Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM);

// Cache Transporter instance để tái sử dụng connection pool
let cachedTransporter = null;

const getTransporter = (env = process.env, createTransport = nodemailer.createTransport) => {
    if (!cachedTransporter) {
        const port = Number(env.SMTP_PORT) || 587;
        cachedTransporter = createTransport({
            host: env.SMTP_HOST,
            port,
            secure: port === 465,
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
            },
            // Tối ưuconnection pooling cho ứng dụng Node.js
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
        });
    }
    return cachedTransporter;
};

async function sendMail(
    { to, subject, text, html },
    env = process.env,
    createTransport = nodemailer.createTransport
) {
    if (!isMailConfigured(env)) {
        throw new MailNotConfiguredError();
    }

    // Tái sử dụng Transporter
    const transporter = getTransporter(env, createTransport);

    return await transporter.sendMail({
        from: env.MAIL_FROM,
        to,
        subject,
        text,
        ...(html && { html }), // Hỗ trợ định dạng HTML nếu truyền vào
    });
}

// Hàm để reset cache Transporter (rất hữu ích khi viết Unit Test)
const clearTransporterCache = () => {
    cachedTransporter = null;
};

module.exports = {
    sendMail,
    isMailConfigured,
    MailNotConfiguredError,
    clearTransporterCache,
};