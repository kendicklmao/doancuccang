const express = require("express");
const app = express();
const cors = require("cors");
const session = require("express-session");

const allowedOrigins = [
  "http://localhost:5180",
  "http://localhost:5177",
  "http://localhost:5173",
  "http://localhost:5174"
];

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

// ✅ Mở CORS cho tất cả các địa chỉ IP, Domain và Port
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
}));

app.use(session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60,
        httpOnly: true,
        secure: false
    }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static("public"));

const router = require("./route/router");
app.use("/api", router);

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});
// Example Express.js Route
app.get('/api/projects/:projectId/burndown-weekly', async (req, res) => {
  const { projectId } = req.params;

  // 1. Lấy tổng Story Points của toàn bộ Project
  const totalPointsResult = await db.query(
    'SELECT SUM(points) AS total FROM tasks WHERE project_id = ?', 
    [projectId]
  );
  const totalPoints = totalPointsResult[0].total || 0;

  // 2. Truy vấn số points đã hoàn thành gom nhóm theo Tuần (Sử dụng WEEK/YEAR trong SQL)
  const completedByWeek = await db.query(`
    SELECT 
      WEEK(completed_at) - WEEK(project_start_date) + 1 AS week_number,
      SUM(points) AS points_done
    FROM tasks
    WHERE project_id = ? AND status = 'DONE'
    GROUP BY week_number
    ORDER BY week_number ASC
  `, [projectId]);

  // 3. Giả định dự án kéo dài 6 tuần, dựng danh sách trả về
  const totalWeeks = 6;
  const pointsPerWeek = totalPoints / totalWeeks;
  let remainingPoints = totalPoints;

  const weeksData = [];
  const currentWeek = getCurrentWeekNumber(); // Hàm lấy tuần hiện tại của dự án

  for (let w = 1; w <= totalWeeks; w++) {
    const planned = Math.max(0, Math.round(totalPoints - pointsPerWeek * w));
    
    let actual = null;
    if (w <= currentWeek) {
      const weekStat = completedByWeek.find(item => item.week_number === w);
      const doneThisWeek = weekStat ? weekStat.points_done : 0;
      remainingPoints -= doneThisWeek;
      actual = remainingPoints;
    }

    weeksData.push({
      week: `Week ${w}`,
      planned,
      actual
    });
  }

  res.json({
    totalPoints,
    currentWeek,
    weeks: weeksData
  });
});
module.exports = { app };