import BSPLLedger from "../../../../models/BSPLLedger.js";

async function deleteById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const existingLedger = await BSPLLedger.findOne({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!existingLedger) {
      return res.status(404).json({
        hasError: true,
        message: "B/S & P&L Ledger not found.",
      });
    }

    await BSPLLedger.deleteOne({ _id: id });

    return res.status(200).json({
      hasError: false,
      message: "B/S & P&L Ledger deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting B/S & P&L Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteById;
