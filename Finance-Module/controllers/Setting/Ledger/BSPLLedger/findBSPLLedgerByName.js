import BSPLLedger from "../../../../models/BSPLLedger.js";

async function findBSPLLedgerByName(req, res) {
  try {
    const { bSPLLedgerName, headOfAccountId, financialYear } = req.body;
    const schoolId = req.user?.schoolId;

    const bsplLedger = await BSPLLedger.findOne({
      schoolId,
      headOfAccountId,
      bSPLLedgerName,
      financialYear,
    });

    return res.status(200).json({
      hasError: false,
      data: bsplLedger || null,
    });
  } catch (error) {
    console.error("Error finding BS & PL Ledger:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default findBSPLLedgerByName;
