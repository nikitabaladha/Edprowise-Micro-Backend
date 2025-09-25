import Contra from "../../../models/Contra.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

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

    if (!["TDS", "TCS"].includes(contra.TDSorTCS)) {
      return res.status(200).json({
        hasError: false,
        message: "No TDS or TCS linked to this Contra.",
        data: [],
      });
    }

    const groupLedger = await GroupLedger.findOne({
      schoolId,
      academicYear,
      groupLedgerName: contra.TDSorTCS,
    });

    if (!groupLedger) {
      return res.status(404).json({
        hasError: true,
        message: `No GroupLedger found for ${contra.TDSorTCS}.`,
      });
    }

    const ledgers = await Ledger.find({
      schoolId,
      academicYear,
      groupLedgerId: groupLedger._id,
    }).select("_id ledgerName");

    return res.status(200).json({
      hasError: false,
      message: "Ledgers fetched successfully!",
      data: ledgers,
    });
  } catch (error) {
    console.error("Error fetching Ledgers:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getById;
