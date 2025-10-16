import Ledger from "../../../../models/Ledger.js";

async function updatePaymentModeById(req, res) {
  try {
    const { id, academicYear } = req.params;
    const schoolId = req.user?.schoolId;
    const { paymentMode } = req.body;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Missing school ID.",
      });
    }

    if (!id) {
      return res.status(400).json({
        hasError: true,
        message: "Missing Ledger ID.",
      });
    }

    if (!id || !academicYear) {
      return res.status(400).json({
        hasError: true,
        message: "Missing Academic Year.",
      });
    }

    const validModes = [
      "Not Defined",
      "Cash",
      "Online Net Banking",
      "Cheque/Bank Account",
    ];
    if (!validModes.includes(paymentMode)) {
      return res.status(400).json({
        hasError: true,
        message: `Invalid payment mode. Valid options are: ${validModes.join(
          ", "
        )}`,
      });
    }

    const updatedLedger = await Ledger.findOneAndUpdate(
      { _id: id, schoolId, academicYear },
      { paymentMode },
      { new: true }
    );

    if (!updatedLedger) {
      return res.status(404).json({
        hasError: true,
        message: "Ledger not found for the given ID and academic year.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Payment mode updated successfully!",
      data: updatedLedger,
    });
  } catch (error) {
    console.error("Error updating payment mode:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updatePaymentModeById;
