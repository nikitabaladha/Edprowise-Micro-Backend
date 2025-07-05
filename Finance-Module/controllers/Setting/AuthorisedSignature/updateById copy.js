import AuthorisedSignature from "../../../models/AuthorisedSignature.js";

async function updateById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const existing = await AuthorisedSignature.findOne({ _id: id, schoolId });

    if (!existing) {
      return res.status(404).json({
        hasError: true,
        message: "Authorised Signature not found.",
      });
    }

    const uploadedFile = req.files?.authorisedSignatureImage?.[0];
    let authorisedSignatureImagePath = existing.authorisedSignatureImage;

    if (uploadedFile) {
      const isImage = uploadedFile.mimetype.startsWith("image/");
      const folderPath = isImage
        ? "/Images/FinanceModule/AuthorisedSignature"
        : "/Documents/FinanceModule/AuthorisedSignature";

      authorisedSignatureImagePath = `${folderPath}/${uploadedFile.filename}`;
    }

    existing.authorisedSignatureImage = authorisedSignatureImagePath;

    await existing.save();

    return res.status(200).json({
      hasError: false,
      message: "Authorised Signature updated successfully.",
      data: existing,
    });
  } catch (error) {
    console.error("Error updating authorised signature:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
