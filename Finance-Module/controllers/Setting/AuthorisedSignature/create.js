import AuthorisedSignature from "../../../models/AuthorisedSignature.js";

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const { academicYear } = req.body;

    if (!academicYear) {
      return res.status(400).json({
        hasError: true,
        message: "Academic Year is required.",
      });
    }

    const { authorisedSignatureImage } = req.files || {};

    if (!authorisedSignatureImage?.[0]) {
      return res.status(400).json({
        hasError: true,
        message: "Authorised Signature is required.",
      });
    }

    const authorisedSignatureImagePath =
      authorisedSignatureImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/AuthorisedSignature"
        : "/Documents/FinanceModule/AuthorisedSignature";

    const authorisedSignatureImageFullPath = `${authorisedSignatureImagePath}/${authorisedSignatureImage[0].filename}`;

    const newAuthorisedSignature = new AuthorisedSignature({
      schoolId,
      authorisedSignatureImage: authorisedSignatureImageFullPath,
      academicYear,
    });

    await newAuthorisedSignature.save();

    return res.status(201).json({
      hasError: false,
      message: "Authorised Signature created successfully!",
      data: newAuthorisedSignature,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Authorised Signature already exists.`,
      });
    }

    console.error("Error creating Authorised Signature:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
