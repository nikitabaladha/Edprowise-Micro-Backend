import PaymentEntry from "../../../models/PaymentEntry.js";

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

    const existingPaymentEntry = await PaymentEntry.findOne({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!existingPaymentEntry) {
      return res.status(404).json({
        hasError: true,
        message: "PaymentEntry not found.",
      });
    }

    existingPaymentEntry.status = "Cancelled";
    await existingPaymentEntry.save();

    return res.status(200).json({
      hasError: false,
      message: "PaymentEntry Cancelled successfully.",
    });
  } catch (error) {
    console.error("Error cancelling PaymentEntry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default cancelById;
