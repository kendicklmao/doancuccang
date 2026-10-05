const express = require("express");
const app = express();
const cors = require("cors");
const session = require("express-session");

// Cho phép nhiều origin
const allowedOrigins = [
  "http://localhost:5180",
  "http://localhost:5174",
  "http://localhost:5173"
];

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// CORS middleware
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static("public"));

const router = require("./route/router");
app.use("/api", router);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// SỬA TẠI ĐÂY: Export cả app và allowedOrigins
module.exports = { app, allowedOrigins };