import Contra from "../../../models/Contra.js";
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

    const contra = await Contra.findOne({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!contra) {
      return res.status(404).json({
        hasError: true,
        message: "Contra not found.",
      });
    }

    // Check if TDS/TCS is linked
    if (!contra.TDSorTCS || !contra.TDSorTCSLedgerId) {
      return res.status(200).json({
        hasError: false,
        message: "No TDS or TCS linked to this Contra.",
        data: [],
      });
    }

    // Directly fetch the ledger by ID
    const ledger = await Ledger.findOne({
      _id: contra.TDSorTCSLedgerId,
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
