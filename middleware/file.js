// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. Tạo thư mục uploads nếu chưa tồn tại
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Cấu hình nơi lưu trữ và tên file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        try {
            // FIX LỖI TÊN FILE TIẾNG VIỆT/KÝ TỰ ĐẶC BIỆT: Chuyển mã hóa latin1 sang UTF-8 chuẩn
            const utf8OriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

            // Lấy phần mở rộng (.pdf, .docx, .png...)
            const ext = path.extname(utf8OriginalName).toLowerCase();

            // Lấy tên file gốc không chứa extension và làm sạch các ký tự đặc biệt
            const baseName = path.basename(utf8OriginalName, ext)
                .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF_\s-]/g, '') // Giữ lại chữ cái, số, tiếng Việt có dấu
                .trim()
                .replace(/\s+/g, '-'); // Thay khoảng trắng bằng dấu gạch ngang (-)

            // Tạo chuỗi timestamp ngẫu nhiên tránh trùng lặp
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);

            // Tên file lưu vào đĩa: [ten-file-goc]-[uniqueSuffix].[ext]
            const finalFileName = `${baseName || 'file'}-${uniqueSuffix}${ext}`;

            cb(null, finalFileName);
        } catch (error) {
            cb(error, null);
        }
    }
});

// 3. Bộ lọc kiểm tra định dạng file (Tránh upload file độc hại)
const fileFilter = (req, file, cb) => {
    // Lấy phần mở rộng file
    const ext = path.extname(file.originalname).toLowerCase();

    // Các định dạng nguy hiểm không cho phép tải lên
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.pl', '.cgi', '.js'];

    if (dangerousExtensions.includes(ext)) {
        return cb(new Error('Định dạng file không được phép tải lên!'), false);
    }

    cb(null, true);
};

// 4. Khởi tạo Middleware Multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // Đã nâng giới hạn lên 50MB (có thể điều chỉnh tùy nhu cầu)
    }
});

module.exports = upload;