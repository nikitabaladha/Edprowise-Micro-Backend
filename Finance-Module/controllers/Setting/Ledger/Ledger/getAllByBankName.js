import Ledger from "../../../../models/Ledger.js";
import GroupLedger from "../../../../models/GroupLedger.js";

async function getAllByBankName(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { financialYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const groupLedgers = await GroupLedger.find({
      schoolId,
      financialYear,
      groupLedgerName: { $in: ["Bank"] },
    });

    const groupLedgerIds = groupLedgers.map((group) => group._id);

    const ledgers = await Ledger.find({
      schoolId,
      financialYear,
      groupLedgerId: { $in: groupLedgerIds },
    })
      .populate("headOfAccountId")
      .sort({ createdAt: -1 });

    const formattedLedgers = ledgers.map((ledger) => ({
      _id: ledger._id,
      ledgerName: ledger.ledgerName,
      headOfAccountName: ledger.headOfAccountId?.headOfAccountName,
      ...ledger.toObject(),
    }));

    return res.status(200).json({
      hasError: false,
      message: "Ledgers fetched successfully!",
      data: formattedLedgers,
    });
  } catch (error) {
    console.error("Error fetching Ledgers:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllByBankName;
