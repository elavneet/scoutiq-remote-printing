const express = require("express");
const cors = require("cors");
const io = require("socket.io-client");
const bodyParser = require("body-parser");
const printer = require("printer");
const querystring = require("querystring");
let axios = require("axios");
const opn = require("open");
const fs = require("fs");
var base64Img = require("base64-img");
const PDFDocument = require("pdfkit");

const socket = io("https://piq-api.lavneet.com");

// Initialize app by creating an express object
const app = express();
// axios.defaults.timeout = 5000;

app.use(cors());
// for parsing application/json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

socket.on("print", (b64) => {
  var filepath = base64Img.imgSync(b64, "", "tmp");
  console.log(filepath);

  // Create a document
  const doc = new PDFDocument({ autoFirstPage: false });
  let writeStream = fs.createWriteStream("to_print.pdf");
  doc.pipe(writeStream);
  var img = doc.openImage("tmp.png");
  doc.addPage({ size: [img.width, img.height] });
  // Pipe its output somewhere, like to a file or HTTP response
  // See below for browser usage
  doc.image(img, 0, 0);
  doc.end();

  writeStream.on("finish", function () {
    fs.readFile("to_print.pdf", function (err, data) {
      if (!err) {
        const printer_name = printer.getDefaultPrinterName() || "";
        console.log("data type is: " + typeof data + ", is buffer: " + Buffer.isBuffer(data));
        console.log("Printing on: " + printer_name);

        printer.printDirect({
          data: data,
          type: "PDF",
          printer: printer_name,
          // options: {
          //   "fit-to-page": true,
          // },
          success: function (id) {
            console.log("printed with id " + id);
          },
          error: function (err) {
            console.error("error on printing: " + err);
          },
        });
      } else console.error("Error reading PDF file:" + err);
    });
  });
});

app.post("/login", (req, res) => {
  const email = req.body.email;
  const pass = req.body.password;

  const data = querystring.stringify({
    user_email: email,
    user_password: pass,
  });
  let headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  axios
    .post("https://piq-api.lavneet.com/v1/user/get_token", data, {
      headers: headers,
    })
    .then((response) => {
      const res_json = response.data;
      if (res_json.status === true) {
        res.send("<h2>LOGIN SUCCESSFUL!</h2>");
        socket.emit("client_details", {
          user_id: res_json.data.id,
          app_token: res_json.data.app_token,
          client_type: "server",
        });
      }
    })
    .catch((err) => {
      res.send("Error: " + err);
    });
});

app.get("/form", (req, res) => {
  var html = "";
  html += "<body>";
  html += "<form action='/login'  method='post'>";
  html += "<p>Username:<input type='text' name='email'></p>";
  html += "<p>Password: <input type='password' name='password'></p>";
  html += "<p><input name='submit' type='submit' value='submit'></p>";
  html += "</form>";
  html += "</body>";
  res.send(html);
});

app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.setHeader("Content-Type", "application/json");
  // Pass to next layer of middleware
  next();
});

app.get("/", (req, res) => {
  res.send("<h1>Printer Configuration</h1>");
});

// Setup web server port. Will be port-proxied using apache or nginx later.
const server = app.listen(9542, () => {
  console.log("SCOUTIQ printer tool listening on 9542");
});
