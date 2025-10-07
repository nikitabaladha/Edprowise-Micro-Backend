import multer from "multer";
import path from "path";
import fs from "fs";

const auditorDocumentFileDir = "./Documents/FinanceModule/AuditorDocument";
const auditorDocumentImageDir = "./Images/FinanceModule/AuditorDocument";

[auditorDocumentFileDir, auditorDocumentImageDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const FinanceFileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const isPdf = file.mimetype === "application/pdf";

      if (file.fieldname === "auditorDocument") {
        cb(null, isPdf ? auditorDocumentFileDir : auditorDocumentImageDir);
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
    if (["auditorDocument"].includes(file.fieldname)) {
      if (allowedTypes.test(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`${file.fieldname} must be JPEG, JPG, PNG, or PDF`));
      }
    } else {
      cb(new Error("Invalid file fieldname"));
    }
  },
}).fields([{ name: "auditorDocument", maxCount: 10 }]);

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
      auditorDocument: {
        displayName: "Auditor Document",
        maxSizeImage: 300 * 1024,
        maxSizePdf: 2 * 1024 * 1024,
      },
    };

    // Validate sizes for all uploaded files
    Object.keys(fieldConfig).forEach((field) => {
      if (files[field]) {
        files[field].forEach((file) => {
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
              `${fieldConfig[field].displayName} "${file.originalname}" (${fileType}) must be less than ${maxSizeStr}`
            );
          }
        });
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
