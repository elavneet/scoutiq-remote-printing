const printer = require("printer");
const fs = require("fs");
var base64Img = require("base64-img");
const PDFDocument = require("pdfkit");

function printDYMO(printer_name) {
  const b64String =
    "data:image/png;base64,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";

  var filepath = base64Img.imgSync(b64String, "", "tmp");
  console.log(filepath);

  // Create a document
  const doc = new PDFDocument({ autoFirstPage: false });
  doc.pipe(fs.createWriteStream("output.pdf"));
  var img = doc.openImage("tmp.png");
  doc.addPage({ size: [img.width, img.height] });
  // Pipe its output somewhere, like to a file or HTTP response
  // See below for browser usage
  doc.image(img, 0, 0);
  doc.end();

  fs.readFile("test.pdf", function (err, data) {
    if (err) {
      console.error("err:" + err);
      return;
    }
    console.log("data type is: " + typeof data + ", is buffer: " + Buffer.isBuffer(data));
    printer.printDirect({
      data: data,
      type: "PDF",
      success: function (id) {
        console.log("printed with id " + id);
      },
      error: function (err) {
        console.error("error on printing: " + err);
      },
    });
  });
}

const fallbackPrinter = "";
const defaultPrinterName = printer.getDefaultPrinterName() || fallbackPrinter;
printDYMO(defaultPrinterName);
