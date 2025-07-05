import Ledger from "../../../../models/Ledger.js";
import GroupLedger from "../../../../models/GroupLedger.js";

async function getAllByName(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const groupLedgers = await GroupLedger.find({
      schoolId,
      groupLedgerName: { $in: ["Bank", "Cash"] },
    });

    const groupLedgerIds = groupLedgers.map((group) => group._id);

    const ledgers = await Ledger.find({
      schoolId,
      groupLedgerId: { $in: groupLedgerIds },
    }).sort({ createdAt: -1 });

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

export default getAllByName;
