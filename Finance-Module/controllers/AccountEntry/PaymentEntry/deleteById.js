import Payment from "../../../models/PaymentEntry.js";

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

    const existingPayment = await Payment.findOne({
      _id: id,
      schoolId,
      financialYear,
    });

    if (!existingPayment) {
      return res.status(404).json({
        hasError: true,
        message: "Payment not found.",
      });
    }

    if (existingPayment.status !== "Draft") {
      return res.status(400).json({
        hasError: true,
        message: "Only payments with status 'Draft' can be deleted.",
      });
    }

    await Payment.deleteOne({ _id: id });

    return res.status(200).json({
      hasError: false,
      message: "Draft Payment deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting Payment:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteById;
