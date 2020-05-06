const express = require("express");
const cors = require("cors");
const io = require("socket.io-client");
const bodyParser = require("body-parser");
const printer = require("printer");
const socket = io("https://piq-api.lavneet.com");
const querystring = require("querystring");
let axios = require("axios");
const opn = require("open");

// Initialize app by creating an express object
const app = express();
// axios.defaults.timeout = 5000;

app.use(cors());
// for parsing application/json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

printISBN = (b64) => {
  console.log(b64);

  let base64Data = b64.replace(/^data:image\/\w+;base64,/, "");
  let dataBuffer = Buffer.from(base64Data, "base64");

  printer.printDirect({
    data: dataBuffer,
    type: "JPEG",
    printer: "",
    success: function (jobID) {
      console.log("sent to printer with ID: " + jobID);
    },
    error: function (err) {
      console.log(err);
    },
  });
};

socket.on("welcome", (socketid) => {
  console.log("message: " + socketid);
  opn("http://localhost:9542/form");
});

socket.on("print", (b64) => {
  printISBN(b64);
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
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
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
