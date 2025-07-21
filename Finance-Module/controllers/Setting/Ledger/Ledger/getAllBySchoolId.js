import Ledger from "../../../../models/Ledger.js";

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission to get all Ledger",
      });
    }

    const academicYear = req.params.academicYear;

    const ledgers = await Ledger.find({ schoolId, academicYear })
      .populate({ path: "headOfAccountId", select: "headOfAccountName" })
      .populate({ path: "groupLedgerId", select: "groupLedgerName" })
      .populate({ path: "bSPLLedgerId", select: "bSPLLedgerName" })
      .sort({ createdAt: -1 });

    const simplifiedLedgers = ledgers.map((ledger) => ({
      _id: ledger._id,
      schoolId: ledger.schoolId,
      ledgerName: ledger.ledgerName,
      ledgerCode: ledger.ledgerCode,
      openingBalance: ledger.openingBalance,
      headOfAccountId: ledger.headOfAccountId?._id ?? null,
      headOfAccountName: ledger.headOfAccountId?.headOfAccountName ?? null,
      groupLedgerId: ledger.groupLedgerId?._id ?? null,
      groupLedgerName: ledger.groupLedgerId?.groupLedgerName ?? null,
      bSPLLedgerId: ledger.bSPLLedgerId?._id ?? null,
      bSPLLedgerName: ledger.bSPLLedgerId?.bSPLLedgerName ?? null,
      createdAt: ledger.createdAt,
      updatedAt: ledger.updatedAt,
    }));

    return res.status(200).json({
      hasError: false,
      message: "Ledgers fetched successfully!",
      data: simplifiedLedgers,
    });
  } catch (error) {
    console.error("Error fetching Ledgers:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
