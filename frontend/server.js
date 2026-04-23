const https = require("https");
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const HOST = "0.0.0.0";

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, "ssl", "backend.key")),
  cert: fs.readFileSync(path.join(__dirname, "ssl", "backend.crt")),

};

app.use(express.static(path.join(__dirname, "build")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
  console.log(`Frontend HTTPS server running at https://${HOST}:${PORT}`);
});