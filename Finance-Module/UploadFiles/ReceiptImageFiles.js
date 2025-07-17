import multer from "multer";
import path from "path";
import fs from "fs";

const receiptFileDir = "./Documents/FinanceModule/ReceiptImage";
const receiptImageDir = "./Images/FinanceModule/ReceiptImage";
const chequeFileForReceiptDir =
  "./Documents/FinanceModule/ChequeImageForReceipt";
const chequeImageForReceiptDir = "./Images/FinanceModule/ChequeImageForReceipt";

[
  receiptFileDir,
  receiptImageDir,
  chequeFileForReceiptDir,
  chequeImageForReceiptDir,
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer
const FinanceFileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const isPdf = file.mimetype === "application/pdf";

      if (file.fieldname === "receiptImage") {
        cb(null, isPdf ? receiptFileDir : receiptImageDir);
      } else if (file.fieldname === "chequeImageForReceipt") {
        cb(null, isPdf ? chequeFileForReceiptDir : chequeImageForReceiptDir);
      } else {
        cb(new Error("Invalid file fieldname"));
      }
    },
    filename: (req, file, cb) => {
      try {
        const sanitizedFilename = file.originalname
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")
          .split(".")[0];
        cb(
          null,
          `${sanitizedFilename}_${Date.now()}${path.extname(file.originalname)}`
        );
      } catch (error) {
        cb(new Error("Failed to generate filename"));
      }
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    if (["receiptImage", "chequeImageForReceipt"].includes(file.fieldname)) {
      if (allowedTypes.test(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`${file.fieldname} must be JPEG, JPG, PNG, or PDF`));
      }
    } else {
      cb(new Error("Invalid file fieldname"));
    }
  },
}).fields([
  { name: "receiptImage", maxCount: 1 },
  { name: "chequeImageForReceipt", maxCount: 1 },
]);

// Middleware
export default (req, res, next) => {
  FinanceFileUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        hasError: true,
        message: err.message,
      });
    }

    const files = req.files || {};
    const sizeErrors = [];

    const fieldConfig = {
      invoiceImage: {
        displayName: "Receipt Image",
        maxSizeImage: 300 * 1024,
        maxSizePdf: 2 * 1024 * 1024,
      },
      chequeImageForReceipt: {
        displayName: "Cheque Image",
        maxSizeImage: 500 * 1024,
        maxSizePdf: 3 * 1024 * 1024,
      },
    };

    // Validate sizes
    Object.keys(fieldConfig).forEach((field) => {
      if (files[field]) {
        const file = files[field][0];
        const isPdf = file.mimetype === "application/pdf";
        const maxSize = isPdf
          ? fieldConfig[field].maxSizePdf
          : fieldConfig[field].maxSizeImage;

        if (file.size > maxSize) {
          const fileType = isPdf ? "PDF" : "image";
          const maxSizeStr = isPdf
            ? `${fieldConfig[field].maxSizePdf / (1024 * 1024)} MB`
            : `${fieldConfig[field].maxSizeImage / 1024} KB`;
          sizeErrors.push(
            `${fieldConfig[field].displayName} ${fileType} must be less than ${maxSizeStr}`
          );
        }
      }
    });

    if (sizeErrors.length > 0) {
      return res.status(400).json({
        hasError: true,
        message: sizeErrors.join(", "),
      });
    }

    next();
  });
};
