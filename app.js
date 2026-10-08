const express = require("express");
const app = express();
const cors = require("cors");
const session = require("express-session");

const allowedOrigins = [
  "http://localhost:5180",
  "http://localhost:5179",
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

module.exports = { app };