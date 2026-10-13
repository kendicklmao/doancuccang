
const cron = require('node-cron');
const Note = require('../model/note');       // Model Note
const Member = require('../model/member');   // Model Member
const mailer = require('../helper/mailer');  // Helper mailer sẵn có

const startNoteReminderJob = () => {
    // Chạy định kỳ vào 07:00 sáng mỗi ngày ('0 7 * * *')
    cron.schedule('0 8 * * *', async () => {
        console.log('[Cron Job] Checking upcoming notes/reminders...');

        try {
            // 1. Tính mốc ngày mai
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const year = tomorrow.getFullYear();
            const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
            const day = String(tomorrow.getDate()).padStart(2, '0');

            const tomorrowStr = `${year}-${month}-${day}`;
            const formattedDateStr = `${day}/${month}/${year}`; // Dạng DD/MM/YYYY cho nội dung mail

            // 2. Lấy các Note có date là ngày mai và chưa gửi thông báo
            const notesToNotify = await Note.find({
                date: tomorrowStr,
                isNotified: { $ne: true }
            }).populate('projectId');

            for (const note of notesToNotify) {
                if (!note.projectId) continue;

                // 3. Tìm email các thành viên trong dự án
                const members = await Member.find({ projectId: note.projectId._id }).populate('userId');
                const recipientEmails = members
                    .map(m => m.userId?.email)
                    .filter(Boolean);

                if (recipientEmails.length > 0) {
                    const projectName = note.projectId?.name || 'Project';

                    // 4. Gửi mail bằng tiếng Anh kèm ngày tháng năm cụ thể
                    await mailer.sendMail({
                        to: recipientEmails.join(','),
                        subject: `[Reminder] Project note scheduled for tomorrow (${formattedDateStr}) in project "${projectName}"`,
                        text: `Hello,\n\nYou have a scheduled note/event in the project "${projectName}" due tomorrow (${formattedDateStr}):\n\nNote Content: ${note.content}\n\nPlease check your project calendar for details.`
                    });

                    // 5. Đánh dấu đã gửi
                    note.isNotified = true;
                    await note.save();
                }
            }
        } catch (error) {
            console.error('[Cron Job] Error sending note reminder email:', error);
        }
    });
};

module.exports = { startNoteReminderJob };