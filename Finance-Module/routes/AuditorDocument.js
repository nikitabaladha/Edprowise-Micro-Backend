import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import upload from "../UploadFiles/AuditorDocument.js";
import uploadUpdate from "../UploadFiles/AuditorDocumentUpdate.js";

import {
  createAuditorDocument,
  updateAuditorDocument,
  getAllAuditorDocument,
  deleteAuditorDocument,
} from "../controllers/AuditorDocument/index.js";

router.post(
  "/create-auditor-document",
  upload,
  roleBasedMiddleware("School"),
  createAuditorDocument
);

router.get(
  "/get-auditor-document",
  roleBasedMiddleware("School"),
  getAllAuditorDocument
);

router.put(
  "/update-auditor-document/:documentId/:itemId",
  roleBasedMiddleware("School"),
  uploadUpdate,
  updateAuditorDocument
);

router.delete(
  "/delete-auditor-document/:documentId/:itemId",
  roleBasedMiddleware("School"),
  deleteAuditorDocument
);

export default router;
