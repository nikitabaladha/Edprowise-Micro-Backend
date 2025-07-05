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

    const authorisedSignatureImagePath =
      req.files?.authorisedSignatureImage?.[0]?.mimetype.startsWith("image/")
        ? "/Images/FinanceModule/AuthorisedSignature"
        : "/Documents/FinanceModule/AuthorisedSignature";
    const authorisedSignatureImage = req.files?.authorisedSignatureImage?.[0]
      ?.filename
      ? `${authorisedSignatureImagePath}/${req.files.authorisedSignatureImage[0].filename}`
      : existing.authorisedSignatureImage;

    const updatedData = {
      authorisedSignatureImage,
    };

    const updateAuthorisedSignature =
      await AuthorisedSignature.findOneAndUpdate(
        { schoolId, _id: id },
        {
          $set: updatedData,
        },
        { new: true }
      );

    return res.status(200).json({
      message: "School details updated successfully!",
      data: updateAuthorisedSignature,
      hasError: false,
    });
  } catch (error) {
    console.error("Error updating Authorised Signature:", error.message);

    return res.status(500).json({
      hasError: true,
      message: "Failed to updat School Profile.",
      error: error.message,
    });
  }
}

export default updateById;
