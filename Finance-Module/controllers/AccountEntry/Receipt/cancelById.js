import Receipt from "../../../models/Receipt.js";

async function cancelById(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { id, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const existingReceipt = await Receipt.findOne({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!existingReceipt) {
      return res.status(404).json({
        hasError: true,
        message: "Receipt not found.",
      });
    }

    existingReceipt.status = "Cancelled";
    await existingReceipt.save();

    return res.status(200).json({
      hasError: false,
      message: "Receipt Cancelled successfully.",
    });
  } catch (error) {
    console.error("Error cancelling Receipt:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default cancelById;
