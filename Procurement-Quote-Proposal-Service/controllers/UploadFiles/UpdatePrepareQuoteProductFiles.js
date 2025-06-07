import multer from "multer";
import path from "path";
import fs from "fs";

const prepareQuoteImageDir = "./Images/PrepareQuoteImage";

if (!fs.existsSync(prepareQuoteImageDir)) {
  fs.mkdirSync(prepareQuoteImageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, prepareQuoteImageDir);
  },
  filename: (req, file, cb) => {
    try {
      const originalNameWithoutExt = path.basename(
        file.originalname,
        path.extname(file.originalname)
      );
      const newFilename = `${originalNameWithoutExt}_${Date.now()}${path.extname(
        file.originalname
      )}`;
      cb(null, newFilename);
    } catch (error) {
      cb(new Error("Failed to generate filename"));
    }
  },
});

const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png/;
  const mimeType = allowedFileTypes.test(file.mimetype);
  const extName = allowedFileTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  if (mimeType && extName) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, JPG, or PNG files are allowed for images."));
  }
};

const UpdatePrepareQuoteImageUpload = multer({
  storage,
  limits: { fileSize: 3 * 100 * 1024 },
  fileFilter,
}).single("prepareQuoteImage");

export default UpdatePrepareQuoteImageUpload;
