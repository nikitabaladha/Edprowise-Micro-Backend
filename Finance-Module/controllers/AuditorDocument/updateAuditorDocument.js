import AuditorDocument from "../../models/AuditorDocument.js";

export async function updateAuditorDocument(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { documentId, itemId } = req.params;
    const { remark } = req.body;
    const { auditorDocument } = req.files || {};

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const existingDocument = await AuditorDocument.findOne({
      _id: documentId,
      schoolId,
    });

    if (!existingDocument) {
      return res.status(404).json({
        hasError: true,
        message: "Auditor Document not found.",
      });
    }

    const itemIndex = existingDocument.itemDetails.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        hasError: true,
        message: "Document item not found.",
      });
    }

    // Update remark if provided
    if (remark !== undefined) {
      existingDocument.itemDetails[itemIndex].remark = remark;
    }

    // Update document if provided
    if (auditorDocument?.[0]) {
      const documentPath = auditorDocument[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/AuditorDocument"
        : "/Documents/FinanceModule/AuditorDocument";

      existingDocument.itemDetails[
        itemIndex
      ].auditorDocument = `${documentPath}/${auditorDocument[0].filename}`;
    }

    await existingDocument.save();

    return res.status(200).json({
      hasError: false,
      message: "Document item updated successfully!",
      data: existingDocument,
    });
  } catch (error) {
    console.error("Error updating Auditor Document item:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateAuditorDocument;
