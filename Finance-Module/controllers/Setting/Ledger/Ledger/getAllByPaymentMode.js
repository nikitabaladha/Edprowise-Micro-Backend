import Ledger from "../../../../models/Ledger.js";

async function getAllByPaymentMode(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { paymentMode, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const validModes = ["Not Defined", "Cash", "Online", "Cheque"];
    if (!validModes.includes(paymentMode)) {
      return res.status(400).json({
        hasError: true,
        message:
          "Invalid payment mode. Valid values are: Not Defined, Cash, Online, Cheque.",
      });
    }

    const ledgers = await Ledger.find({
      schoolId,
      academicYear,
      paymentMode,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      hasError: false,
      message: `Ledgers with payment mode '${paymentMode}' fetched successfully!`,
      data: ledgers,
    });
  } catch (error) {
    console.error("Error fetching Ledgers by paymentMode:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllByPaymentMode;
