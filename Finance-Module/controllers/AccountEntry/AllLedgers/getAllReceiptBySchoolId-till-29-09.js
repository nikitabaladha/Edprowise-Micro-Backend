import Receipt from "../../../models/Receipt.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";
import mongoose from "mongoose";

async function getAllReceiptBySchoolId(req, res) {
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

    const receiptEntries = await Receipt.find({
      schoolId,
      ...dateFilter,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

    // Find Receipt Entries

    for (const entry of receiptEntries) {
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
          itemName: item.itemName,
          ledgerId: item.ledgerId || null,
          ledgerName: ledger?.ledgerName || null,

          debitAmount: item.debitAmount || null,
          amount: item.amount,

          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,
        });
      }

      const ledgerWithPaymentMode =
        entry.ledgerIdWithPaymentMode &&
        mongoose.Types.ObjectId.isValid(entry.ledgerIdWithPaymentMode)
          ? await Ledger.findById(entry.ledgerIdWithPaymentMode)
              .select("ledgerName groupLedgerId")
              .lean()
          : null;

      let groupLedgerWithPaymentMode = null;
      if (ledgerWithPaymentMode?.groupLedgerId) {
        groupLedgerWithPaymentMode = await GroupLedger.findOne({
          _id: ledgerWithPaymentMode.groupLedgerId,
          schoolId,
        })
          .select("groupLedgerName")
          .lean();
      }

      let TDSorTCSGroupLedgerName = null;
      let TDSorTCSLedgerName = null;

      if (entry.TDSorTCS && entry.TDSorTCSLedgerId) {
        // 1. Find the TDS/TCS Ledger using the stored TDSorTCSLedgerId
        const tdsOrTcsLedger = await Ledger.findOne({
          _id: entry.TDSorTCSLedgerId,
          schoolId,
        })
          .select("ledgerName groupLedgerId")
          .lean();

        if (tdsOrTcsLedger) {
          TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;

          // 2. Find the GroupLedger connected to this ledger
          const tdsOrTcsGroupLedger = await GroupLedger.findOne({
            _id: tdsOrTcsLedger.groupLedgerId,
            schoolId,
          })
            .select("groupLedgerName")
            .lean();

          if (tdsOrTcsGroupLedger) {
            TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;
          }
        }
      }

      const entryData = {
        // PaymentEntry fields
        accountingEntry: "Receipt",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        receiptDate: entry.receiptDate,
        narration: entry.narration,
        chequeNumber: entry.chequeNumber || null,
        transactionNumber: entry.transactionNumber || null,
        TDSTCSRateWithAmount: entry.TDSTCSRateWithAmount,

        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        groupLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.groupLedgerId || null,
        groupLedgerNameWithPaymentMode:
          groupLedgerWithPaymentMode?.groupLedgerName || null,
        receiptVoucherNumber: entry.receiptVoucherNumber || null,
        TDSorTCS: entry.TDSorTCS || null,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,

        // Item details
        itemDetails: itemsWithLedgerNames,

        customizeEntry: entry.customizeEntry,

        subTotalAmount: entry.subTotalAmount,
        subTotalOfDebit: entry.subTotalOfDebit,
        totalAmount: entry.totalAmount,
        totalDebitAmount: entry.totalDebitAmount,
      };

      formattedData.push(entryData);
    }

    return res.status(200).json({
      hasError: false,
      message: "All Receipts fetched successfully with all info.",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching Receipts:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllReceiptBySchoolId;
