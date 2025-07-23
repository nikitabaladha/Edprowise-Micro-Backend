import Journal from "../../../models/Journal.js";
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

    // Get all Journals for the school & year
    const Journals = await Journal.find({ schoolId, academicYear })
      .sort({ createdAt: -1 })
      .lean();

    const allLedgerIds = new Set();
    Journals.forEach((entry) => {
      entry.itemDetails.forEach((item) => {
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          allLedgerIds.add(item.ledgerId.toString());
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
    const formattedData = Journals.map((entry) => {
      const itemsWithLedgerNames = entry.itemDetails.map((item) => ({
        ledgerId: item.ledgerId || null,
        ledgerName: ledgerMap[item.ledgerId?.toString()] || null,
        description: item.description,
        debitAmount: item.debitAmount || 0,
        creditAmount: item.creditAmount || 0,
      }));

      return {
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        narration: entry.narration,
        subTotalOfDebit: entry.subTotalOfDebit,
        subTotalOfCredit: entry.subTotalOfCredit,
        TDSorTCS: entry.TDSorTCS,
        TDSTCSRateWithDebitAmount: entry.TDSTCSRateWithDebitAmount,
        TDSTCSRateWithCreditAmount: entry.TDSTCSRateWithCreditAmount,
        totalAmountOfCredit: entry.totalAmountOfCredit,
        totalAmountOfDebit: entry.totalAmountOfDebit,
        status: entry.status || null,
        journalVoucherNumber: entry.journalVoucherNumber || null,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // Enriched items
        itemDetails: itemsWithLedgerNames,
      };
    });

    return res.status(200).json({
      hasError: false,
      message: "Journals fetched successfully with ledger info.",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching Journals:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
