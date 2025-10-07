import Journal from "../../../models/Journal.js";
import Ledger from "../../../models/Ledger.js";

async function getById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const journal = await Journal.findOne({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!journal) {
      return res.status(404).json({
        hasError: true,
        message: "Journal not found.",
      });
    }

    // Check if TDS/TCS is linked
    if (!journal.TDSorTCS || !journal.TDSorTCSLedgerId) {
      return res.status(200).json({
        hasError: false,
        message: "No TDS or TCS linked to this Journal.",
        data: [],
      });
    }

    // Directly fetch the ledger by ID
    const ledger = await Ledger.findOne({
      _id: journal.TDSorTCSLedgerId,
      schoolId,
      academicYear,
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
