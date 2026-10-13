// Phát sự kiện realtime cho một route NGAY SAU KHI response thành công (2xx) đã được gửi,
// tức là sau khi controller đã ghi DB xong. Lỗi 4xx/5xx không phát gì; lỗi socket không ảnh hưởng REST.
// Payload chỉ chứa id; client cần dữ liệu thì gọi REST (có xác thực/phân quyền).
const { emitToApp } = require("../socket");

const str = (v) => (v === undefined || v === null || v === "" ? undefined : String(Array.isArray(v) ? v[v.length - 1] : v._id || v));

function emitOnSuccess(event, buildPayload) {
    return (req, res, next) => {
        let body;
        const json = res.json.bind(res);
        res.json = (b) => { body = b; return json(b); };
        res.on("finish", () => {
            if (res.statusCode < 200 || res.statusCode >= 300) return;
            try {
                const payload = buildPayload(req, body) || {};
                Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
                emitToApp(event, payload);
            } catch (err) {
                console.error(`Realtime payload error (${event}):`, err.message);
            }
        });
        next();
    };
}

module.exports = { emitOnSuccess, str };
