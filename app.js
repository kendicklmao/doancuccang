const express = require("express");
const app = express();

const cors = require("cors");
app.use(cors({
        origin: "http://localhost:5173",
        methods:["GET","POST","PUT","DELETE"],
        allowedHeaders: ["Content-Type","Authorization"]
    })
);

const session = require("express-session");
app.use(session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000*60*60,
        httpOnly: true,
        secure: false
    }
}));


app.use(express.json());

app.use(express.static("public"));

const router = require("./route/router");
app.use("/api",router);

app.get("/",(req,res)=>{
    res.sendFile(__dirname+"/public/index.html");
})
module.exports = app;