import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import upload from "../UploadFiles/AuthorisedSignatureImageFiles.js";

import {
  createAuthorisedSignature,
  getOneAuthorisedSignatureBySchoolId,
  updateAuthorisedSignatureById,
} from "../controllers/Setting/AuthorisedSignature/index.js";

router.post(
  "/create-authorised-signature",
  upload,
  roleBasedMiddleware("School"),
  createAuthorisedSignature
);

router.get(
  "/get-authorised-signature-by-school-id/:academicYear",
  roleBasedMiddleware("School"),
  getOneAuthorisedSignatureBySchoolId
);

router.put(
  "/update-authorised-signature/:id/:academicYear",
  upload,
  roleBasedMiddleware("School"),
  updateAuthorisedSignatureById
);

export default router;
