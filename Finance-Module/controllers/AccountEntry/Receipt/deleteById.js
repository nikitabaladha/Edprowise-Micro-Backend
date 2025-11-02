import Receipt from "../../../models/Receipt.js";

async function deleteById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id, financialYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const existingReceipt = await Receipt.findOne({
      _id: id,
      schoolId,
      financialYear,
    });

    if (!existingReceipt) {
      return res.status(404).json({
        hasError: true,
        message: "Receipt not found.",
      });
    }

    if (existingReceipt.status !== "Draft") {
      return res.status(400).json({
        hasError: true,
        message: "Only payments with status 'Draft' can be deleted.",
      });
    }

    await Receipt.deleteOne({ _id: id });

    return res.status(200).json({
      hasError: false,
      message: "Draft Receipt deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting Receipt:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteById;
