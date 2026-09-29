const express = require("express");
const app = express();
const cors = require("cors");
const session = require("express-session");

// Cho phép nhiều origin (ví dụ frontend chạy ở 5173, 5179, 5185...)
const allowedOrigins = [
  "http://localhost:5179",
  "http://localhost:5185",
  "http://localhost:5174"
];

// Chỉ giữ lại 1 middleware CORS duy nhất này:
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
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

// Đặt express.json() trước khi load router
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const router = require("./route/router");
app.use("/api", router);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

module.exports = app;