const mongoose = require('mongoose');

// One pending password-reset OTP per email. The OTP itself is never stored, only its HMAC.
const passwordResetSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    // requests inside the current hour window (resend cap)
    windowStart: { type: Date, required: true },
    sendCount: { type: Number, default: 1 },
}, { timestamps: true });

// MongoDB removes the document once the OTP has expired
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
