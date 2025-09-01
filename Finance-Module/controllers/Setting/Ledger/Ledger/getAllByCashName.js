import Ledger from "../../../../models/Ledger.js";
import GroupLedger from "../../../../models/GroupLedger.js";

async function getByCashName(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const cashGroup = await GroupLedger.findOne({
      schoolId,
      academicYear,
      groupLedgerName: "Cash",
    });

    if (!cashGroup) {
      return res.status(404).json({
        hasError: true,
        message: "Cash group ledger not found.",
      });
    }

    const cashLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      groupLedgerId: cashGroup._id,
    })
      .populate("headOfAccountId")
      .sort({ createdAt: -1 });

    if (!cashLedger) {
      return res.status(404).json({
        hasError: true,
        message: "Ledger under Cash group not found.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Cash ledger fetched successfully!",
      data: cashLedger,
    });
  } catch (error) {
    console.error("Error fetching Cash ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getByCashName;
