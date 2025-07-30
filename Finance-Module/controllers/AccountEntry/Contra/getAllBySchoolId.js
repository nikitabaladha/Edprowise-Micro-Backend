import Contra from "../../../models/Contra.js";
import Ledger from "../../../models/Ledger.js";
import mongoose from "mongoose";

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    // Get all Contras for the school & year
    const Contras = await Contra.find({ schoolId, academicYear })
      .sort({ createdAt: -1 })
      .lean();

    const allLedgerIds = new Set();
    Contras.forEach((entry) => {
      entry.itemDetails.forEach((item) => {
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          allLedgerIds.add(item.ledgerId.toString());
        }
        if (
          item.ledgerIdOfCashAccount &&
          mongoose.Types.ObjectId.isValid(item.ledgerIdOfCashAccount)
        ) {
          allLedgerIds.add(item.ledgerIdOfCashAccount.toString());
        }
      });
    });

    // Fetch all required ledgers in one query
    const ledgers = await Ledger.find({
      _id: { $in: Array.from(allLedgerIds) },
      schoolId,
    })
      .select("ledgerName")
      .lean();

    // Create a map for quick lookup
    const ledgerMap = {};
    ledgers.forEach((ledger) => {
      ledgerMap[ledger._id.toString()] = ledger.ledgerName;
    });

    // Format the response
    const formattedData = Contras.map((entry) => {
      const itemsWithLedgerNames = entry.itemDetails.map((item) => ({
        ledgerId: item.ledgerId || null,
        ledgerName: ledgerMap[item.ledgerId?.toString()] || null,
        ledgerIdOfCashAccount: item.ledgerIdOfCashAccount || null,
        ledgerNameOfCashAccount:
          ledgerMap[item.ledgerIdOfCashAccount?.toString()] || null,
        debitAmount: item.debitAmount || 0,
        creditAmount: item.creditAmount || 0,
      }));

      return {
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        dateOfCashDepositedWithdrawlDate:
          entry.dateOfCashDepositedWithdrawlDate,
        narration: entry.narration,
        subTotalOfDebit: entry.subTotalOfDebit,
        subTotalOfCredit: entry.subTotalOfCredit,
        TDSorTCS: entry.TDSorTCS || null,
        TDSTCSRateAmount: entry.TDSTCSRateAmount || 0,
        totalAmountOfCredit: entry.totalAmountOfCredit,
        totalAmountOfDebit: entry.totalAmountOfDebit,
        chequeImageForContra: entry.chequeImageForContra || null,
        status: entry.status || null,
        contraVoucherNumber: entry.contraVoucherNumber || null,
        contraEntryName: entry.contraEntryName || null,
        chequeNumber: entry.chequeNumber || null,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // Enriched items
        itemDetails: itemsWithLedgerNames,
      };
    });

    return res.status(200).json({
      hasError: false,
      message: "Contras fetched successfully with ledger info.",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching Contras:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
