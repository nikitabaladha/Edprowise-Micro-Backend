import Ledger from "../../../../models/Ledger.js";

async function findLedgerByName(req, res) {
  try {
    const {
      ledgerName,
      headOfAccountId,
      bSPLLedgerId,
      groupLedgerId,
      financialYear,
    } = req.body;
    const schoolId = req.user?.schoolId;

    const ledger = await Ledger.findOne({
      schoolId,
      headOfAccountId,
      bSPLLedgerId,
      groupLedgerId,
      ledgerName,
      financialYear,
    });

    return res.status(200).json({
      hasError: false,
      data: ledger || null,
    });
  } catch (error) {
    console.error("Error finding Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default findLedgerByName;
