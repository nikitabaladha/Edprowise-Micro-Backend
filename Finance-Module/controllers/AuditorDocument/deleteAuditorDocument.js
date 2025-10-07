import AuditorDocument from "../../models/AuditorDocument.js";

export async function deleteAuditorDocument(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { documentId, itemId } = req.params;

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

    existingDocument.itemDetails.splice(itemIndex, 1);

    await existingDocument.save();

    return res.status(200).json({
      hasError: false,
      message: "Document item deleted successfully!",
      data: existingDocument,
    });
  } catch (error) {
    console.error("Error deleting Auditor Document item:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteAuditorDocument;
