const nodemailer = require('nodemailer');

class MailNotConfiguredError extends Error {
    constructor() {
        super('Email service is not configured');
        this.code = 'MAIL_NOT_CONFIGURED';
    }
}

// Needs SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM (SMTP_PORT optional, default 587) in the environment, never in source.
const isMailConfigured = (env = process.env) => Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM);

async function sendMail({ to, subject, text }, env = process.env, createTransport = nodemailer.createTransport) {
    if (!isMailConfigured(env)) throw new MailNotConfiguredError();
    const port = Number(env.SMTP_PORT) || 587;
    const transporter = createTransport({
        host: env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    await transporter.sendMail({ from: env.MAIL_FROM, to, subject, text });
}

module.exports = { sendMail, isMailConfigured, MailNotConfiguredError };
