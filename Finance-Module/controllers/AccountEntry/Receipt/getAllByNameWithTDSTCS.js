import Receipt from "../../../models/Receipt.js";
import Ledger from "../../../models/Ledger.js";

async function getById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id, financialYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const receipt = await Receipt.findOne({
      _id: id,
      schoolId,
      financialYear,
    });

    if (!receipt) {
      return res.status(404).json({
        hasError: true,
        message: "Receipt not found.",
      });
    }

    // Check if TDS/TCS is linked
    if (!receipt.TDSorTCS || !receipt.TDSorTCSLedgerId) {
      return res.status(200).json({
        hasError: false,
        message: "No TDS or TCS linked to this Receipt.",
        data: [],
      });
    }

    // Directly fetch the ledger by ID
    const ledger = await Ledger.findOne({
      _id: receipt.TDSorTCSLedgerId,
      schoolId,
      financialYear,
    }).select("_id ledgerName");

    if (!ledger) {
      return res.status(404).json({
        hasError: true,
        message: "Ledger not found for the given TDS/TCSLedgerId.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Ledger fetched successfully!",
      data: ledger,
    });
  } catch (error) {
    console.error("Error fetching Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getById;
