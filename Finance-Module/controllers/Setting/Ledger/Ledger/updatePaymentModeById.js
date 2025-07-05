import Ledger from "../../../../models/Ledger.js";

async function updatePaymentModeById(req, res) {
  try {
    const { id } = req.params;
    const { paymentMode } = req.body;

    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to update Payment Mode.",
      });
    }

    const validModes = ["Not Defined", "Cash", "Online", "Cheque"];
    if (!validModes.includes(paymentMode)) {
      return res.status(400).json({
        hasError: true,
        message: `Invalid payment mode. Valid values: ${validModes.join(", ")}`,
      });
    }

    const existingLedger = await Ledger.findOneAndUpdate(
      { _id: id, schoolId },
      { paymentMode },
      { new: true }
    );

    if (!existingLedger) {
      return res.status(404).json({
        hasError: true,
        message: "Ledger not found.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Payment Mode updated successfully!",
      data: existingLedger,
    });
  } catch (error) {
    console.error("Error updating Payment Mode:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updatePaymentModeById;
