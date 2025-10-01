import Journal from "../../../models/Journal.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";
import mongoose from "mongoose";

async function getAllJournalBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { academicYear } = req.params;
    const { startDate, endDate } = req.query;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    // Create date filter object
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.entryDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (academicYear) {
      const yearParts = academicYear.split("-");
      if (yearParts.length === 2) {
        const startYear = parseInt(yearParts[0]);
        const endYear = parseInt(yearParts[1]);
        dateFilter.entryDate = {
          $gte: new Date(`${startYear}-04-01`),
          $lte: new Date(`${endYear}-03-31`),
        };
      }
    }

    const JournalEntries = await Journal.find({
      schoolId,
      ...dateFilter,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

    // Find Journal Entries

    for (const entry of JournalEntries) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select("ledgerName groupLedgerId")
            .lean();
        }

        let groupLedger = null;
        if (ledger?.groupLedgerId) {
          groupLedger = await GroupLedger.findOne({
            _id: ledger.groupLedgerId,
            schoolId,
          })
            .select("groupLedgerName")
            .lean();
        }

        itemsWithLedgerNames.push({
          description: item.description,
          ledgerId: item.ledgerId || null,
          debitAmount: item.debitAmount,
          creditAmount: item.creditAmount,
          ledgerName: ledger?.ledgerName || null,
          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,
        });
      }

      const entryData = {
        accountingEntry: "Journal",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        documentDate: entry.documentDate,
        narration: entry.narration,
        TDSTCSRateWithDebitAmount: entry.TDSTCSRateWithDebitAmount,
        TDSTCSRateWithCreditAmount: entry.TDSTCSRateWithCreditAmount,

        subTotalOfDebit: entry.subTotalOfDebit,
        subTotalOfCredit: entry.subTotalOfCredit,

        totalAmountOfDebit: entry.totalAmountOfDebit,
        totalAmountOfCredit: entry.totalAmountOfCredit,
        journalVoucherNumber: entry.journalVoucherNumber || null,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // Item details
        itemDetails: itemsWithLedgerNames,
        customizeEntry: entry.customizeEntry,

        approvalStatus: entry.approvalStatus,
        reasonOfDisapprove: entry.reasonOfDisapprove,
        documentImage: entry.documentImage,
      };

      formattedData.push(entryData);
    }

    return res.status(200).json({
      hasError: false,
      message: "All Journals fetched successfully with all info.",
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

export default getAllJournalBySchoolId;
