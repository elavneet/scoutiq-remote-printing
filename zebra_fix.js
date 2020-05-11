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
const potrace = require("potrace");

var api_domain_name = "https://api.palletiq.com";

const socket = io(api_domain_name, {
  pingTimeout: 30000,
});

// Initialize app by creating an express object
const app = express();

app.use(cors());
// for parsing application/json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

global.printer_name = "";
global.label_height = "";
global.label_height = "";

socket.on("print", (print_instructions) => {
  console.log(printer_name.toLowerCase());

  // IF THE PRINTER IS ZEBRA, SEND "RAW" COMMAND
  if (
    printer_name.toLowerCase().indexOf("zebra") >= 0 ||
    printer_name.toLowerCase().indexOf("pdf") >= 0
  ) {
    const template = 'N\nS4\nD15\nq400\nR\nB20,10,0,1,2,30,173,B,"barcode"\nP0\n';

    printer.printDirect({
      data: template.replace(/barcode/, print_instructions.isbn),
      printer: printer_name,
      type: "RAW",
      success: function () {
        console.log("printed: " + print_instructions.isbn);
      },
      error: function (err) {
        console.log(err);
      },
    });
  }

  // IF THE PRINTER IS DYMO, SEND "RAW" COMMAND
  if (printer_name.toLowerCase().indexOf("dymo") >= 0) {
    var filepath = base64Img.imgSync(print_instructions.b64, "", "tmp");
    console.log(filepath);
    potrace.trace("tmp.png", function (err, svg) {
      if (err) throw err;
      fs.writeFileSync("tmp.svg", svg);
    });

    // Create a document
    const doc = new PDFDocument({
      autoFirstPage: false,
    });
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
          console.log(
            `Printer: ${global.printer_name} | Label Width: ${global.label_width} | Label Height: ${global.label_height}`
          );

          if (global.printer_name !== "" && global.label_height > 0 && global.label_width > 0) {
            printer.printDirect({
              data: data,
              type: "PDF",
              printer: global.printer_name,
              options: {
                "fit-to-page": true,
                media: "Custom." + global.label_width + "x" + global.label_height + "in",
              },
              success: function (id) {
                console.log("printed with id " + id);
              },
              error: function (err) {
                console.error("error on printing: " + err);
              },
            });
          } else {
            console.log("Skipped printing. No printer specified.");
          }
        } else console.error("Error reading PDF file:" + err);
      });
    });
  }
});

app.post("/settings", (req, res) => {
  const email = req.body.email;
  const pass = req.body.password;
  const printer_name = "printer_name" in req.body ? req.body.printer_name : "";
  const label_width = "label_width" in req.body ? req.body.label_width : 0;
  const label_height = "label_height" in req.body ? req.body.label_height : 0;

  const data = querystring.stringify({
    user_email: email,
    user_password: pass,
    printer_name: printer_name,
    label_width: label_width,
    label_height: label_height,
  });

  let headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  axios
    .post(api_domain_name + "/v1/user/printer_server", data, {
      headers: headers,
    })
    .then((response) => {
      const res_json = response.data;
      if (res_json.status === true) {
        global.printer_name = res_json.data.printer_name;
        global.label_width = res_json.data.label_width;
        global.label_height = res_json.data.label_height;

        let printer_options = "";
        printer.getPrinters().forEach((p) => {
          const is_default = res_json.data.printer_name === p.name ? "selected='selected'" : "";
          printer_options +=
            "<option " + is_default + " value='" + p.name + "'>" + p.name + "</option>";
        });

        var html = "";
        html += "<body>";
        html += "<h2>Printer Settings</h2>";
        html += "<form action='http://localhost:9542/settings'  method='post'>";
        html += "<input type='hidden' name='email' value=" + email + ">";
        html += "<input type='hidden' name='password' value=" + pass + ">";
        html += "<p>Printer: <select name='printer_name'>" + printer_options + "</select></p>";
        html +=
          "<p>Label Size: <input value='" +
          res_json.data.label_width +
          "' name='label_width' style='width:50px;' type='text'>in X <input value='" +
          res_json.data.label_height +
          "' name='label_height' style='width:50px;' type='text'>in</p>";

        html += "<p><input name='submit' type='submit' value='submit'></p>";
        html +=
          "</form><div style='margin-top:40px;'><strong>NOTE:</strong> You may close this window now. To reopen config page, open <strong>localhost:9542</strong> from your browser.</div>";
        html += "</body>";
        res.send(html);

        if (printer_name === "" && label_height === 0 && label_width === 0)
          socket.emit("client_details", {
            user_id: res_json.data.id,
            app_token: res_json.data.app_token,
            client_type: "server",
          });
      } else {
        res.status(400).send(res_json);
      }
    })
    .catch((err) => {
      res.send("Error: " + err);
    });
});

app.get("/", (req, res) => {
  var html = "";
  html += "<body>";
  html += "<form action='/settings'  method='post'>";
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

// Setup web server port. Will be port-proxied using apache or nginx later.
const server = app.listen(9542, () => {
  opn("http://localhost:9542/");
  console.log("SCOUTIQ printer tool listening on 9542");
});
