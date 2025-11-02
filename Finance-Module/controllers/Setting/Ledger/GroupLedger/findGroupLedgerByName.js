import GroupLedger from "../../../../models/GroupLedger.js";

async function findGroupLedgerByName(req, res) {
  try {
    const { groupLedgerName, headOfAccountId, bSPLLedgerId, financialYear } =
      req.body;
    const schoolId = req.user?.schoolId;

    const groupLedger = await GroupLedger.findOne({
      schoolId,
      headOfAccountId,
      bSPLLedgerId,
      groupLedgerName,
      financialYear,
    });

    return res.status(200).json({
      hasError: false,
      data: groupLedger || null,
    });
  } catch (error) {
    console.error("Error finding Group Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default findGroupLedgerByName;
