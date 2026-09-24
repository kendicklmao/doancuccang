const express = require("express");
const app = express();

const cors = require("cors");
app.use(cors({
  credentials: true                // cho phép gửi cookie
}));
// Cho phép nhiều origin (ví dụ frontend chạy ở 5173 hoặc 5184)
const allowedOrigins = ["http://localhost:5177", "http://localhost:5185"];

app.use(cors({
  origin: function (origin, callback) {
    // Nếu không có origin (ví dụ request từ Postman) hoặc origin hợp lệ
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true // cho phép gửi cookie/session
}));

const session = require("express-session");

app.use(session({
  secret: "your-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60, // 1 giờ
    httpOnly: true,
    secure: false // để true nếu dùng HTTPS
  }
}));

app.use(express.json());
app.use(express.static("public"));

const router = require("./route/router");
app.use("/api", router);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

module.exports = app;
