import Ledger from "../../../../models/Ledger.js";
import OpeningClosingBalance from "../../../../models/OpeningClosingBalance.js";

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission to get all Ledger",
      });
    }

    const financialYear = req.params.financialYear;

    const ledgers = await Ledger.find({ schoolId, financialYear })
      .populate({ path: "headOfAccountId", select: "headOfAccountName" })
      .populate({ path: "groupLedgerId", select: "groupLedgerName" })
      .populate({ path: "bSPLLedgerId", select: "bSPLLedgerName" })
      .sort({ createdAt: -1 });

    // Get all ledger IDs to fetch their opening closing balances
    const ledgerIds = ledgers.map((ledger) => ledger._id);

    // Fetch opening closing balances for all ledgers in one query
    const openingClosingBalances = await OpeningClosingBalance.find({
      schoolId,
      financialYear,
      ledgerId: { $in: ledgerIds },
    });

    // Create a map for quick lookup: ledgerId -> totalDebit
    const ledgerDebitMap = new Map();

    openingClosingBalances.forEach((ocb) => {
      const ledgerId = ocb.ledgerId.toString();

      // Calculate total debit for this ledger
      const totalDebit = ocb.balanceDetails.reduce((sum, detail) => {
        return sum + (detail.debit || 0);
      }, 0);

      ledgerDebitMap.set(ledgerId, totalDebit);
    });

    const simplifiedLedgers = ledgers.map((ledger) => {
      const ledgerId = ledger._id.toString();
      const totalDebit = ledgerDebitMap.get(ledgerId) || 0;

      return {
        _id: ledger._id,
        schoolId: ledger.schoolId,
        financialYear: ledger.financialYear,
        ledgerName: ledger.ledgerName,
        ledgerCode: ledger.ledgerCode,
        openingBalance: ledger.openingBalance,
        balanceType: ledger?.balanceType,
        headOfAccountId: ledger.headOfAccountId?._id ?? null,
        headOfAccountName: ledger.headOfAccountId?.headOfAccountName ?? null,
        groupLedgerId: ledger.groupLedgerId?._id ?? null,
        groupLedgerName: ledger.groupLedgerId?.groupLedgerName ?? null,
        bSPLLedgerId: ledger.bSPLLedgerId?._id ?? null,
        bSPLLedgerName: ledger.bSPLLedgerId?.bSPLLedgerName ?? null,
        parentLedgerId: ledger.parentLedgerId ?? null,
        totalDebit: totalDebit,
        createdAt: ledger.createdAt,
        updatedAt: ledger.updatedAt,
        paymentMode: ledger.paymentMode ?? null,
      };
    });

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
