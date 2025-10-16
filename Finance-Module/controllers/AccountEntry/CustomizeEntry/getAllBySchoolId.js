import PaymentEntry from "../../../models/PaymentEntry.js";
import Receipt from "../../../models/Receipt.js";
import Journal from "../../../models/Journal.js";
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

    const paymentEntries = await PaymentEntry.find({
      schoolId,
      academicYear,
      customizeEntry: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const receipts = await Receipt.find({
      schoolId,
      academicYear,
      customizeEntry: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const JournalEntries = await Journal.find({
      schoolId,
      academicYear,
      customizeEntry: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const ContraEntries = await Contra.find({
      schoolId,
      academicYear,
      customizeEntry: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

    for (const entry of paymentEntries) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select("ledgerName")
            .lean();
        }

        itemsWithLedgerNames.push({
          itemName: item.itemName,
          ledgerId: item.ledgerId || null,
          ledgerName: ledger?.ledgerName || null,
          amountAfterGST: item.amountAfterGST || null,
          creditAmount: item.creditAmount || null,
        });
      }

      const entryData = {
        accountingEntry: "Payment",
        _id: entry._id,
        schoolId: entry.schoolId,
        academicYear: entry.academicYear,
        entryDate: entry.entryDate,
        invoiceDate: entry.invoiceDate,
        narration: entry.narration,
        invoiceImage: entry.invoiceImage,
        status: entry.status || null,
        paymentVoucherNumber: entry.paymentVoucherNumber || null,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        subTotalAmountAfterGST: entry.subTotalAmountAfterGST,
        subTotalOfCredit: entry.subTotalOfCredit,

        totalAmountAfterGST: entry.totalAmountAfterGST,
        totalCreditAmount: entry.totalCreditAmount,

        // Item details
        itemDetails: itemsWithLedgerNames,
      };

      formattedData.push(entryData);
    }

    for (const entry of receipts) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select("ledgerName")
            .lean();
        }

        itemsWithLedgerNames.push({
          itemName: item.itemName,
          ledgerId: item.ledgerId || null,
          ledgerName: ledger?.ledgerName || null,
          amount: item.amount || null,
          debitAmount: item.debitAmount || null,
        });
      }

      const entryData = {
        accountingEntry: "Receipt",
        _id: entry._id,
        schoolId: entry.schoolId,
        academicYear: entry.academicYear,
        entryDate: entry.entryDate,
        receiptDate: entry.receiptDate,
        narration: entry.narration,
        receiptImage: entry.receiptImage,
        status: entry.status || null,
        receiptVoucherNumber: entry.receiptVoucherNumber || null,

        subTotalAmount: entry.subTotalAmount,
        subTotalOfDebit: entry.subTotalOfDebit,
        totalAmount: entry.totalAmount,
        totalDebitAmount: entry.totalDebitAmount,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // Item details
        itemDetails: itemsWithLedgerNames,
      };

      formattedData.push(entryData);
    }

    for (const entry of JournalEntries) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select("ledgerName")
            .lean();
        }

        itemsWithLedgerNames.push({
          description: item.description,
          ledgerId: item.ledgerId || null,
          debitAmount: item.debitAmount || null,
          creditAmount: item.creditAmount || null,
          ledgerName: ledger?.ledgerName || null,
        });
      }

      const entryData = {
        accountingEntry: "Journal",
        _id: entry._id,
        schoolId: entry.schoolId,
        academicYear: entry.academicYear,
        entryDate: entry.entryDate,
        documentDate: entry.documentDate,
        documentImage: entry.documentImage || null,
        narration: entry.narration,
        journalVoucherNumber: entry.journalVoucherNumber || null,
        status: entry.status,

        subTotalOfDebit: entry.subTotalOfDebit,
        subTotalOfCredit: entry.subTotalOfCredit,

        totalAmountOfDebit: entry.totalAmountOfDebit,
        totalAmountOfCredit: entry.totalAmountOfCredit,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // Item details
        itemDetails: itemsWithLedgerNames,
      };

      formattedData.push(entryData);
    }

    for (const entry of ContraEntries) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select("ledgerName")
            .lean();
        }

        itemsWithLedgerNames.push({
          itemName: item.itemName || null,
          ledgerId: item.ledgerId || null,
          debitAmount: item.debitAmount || null,
          creditAmount: item.creditAmount || null,
          ledgerName: ledger?.ledgerName || null,
        });
      }

      const entryData = {
        accountingEntry: "Contra",
        _id: entry._id,
        schoolId: entry.schoolId,
        academicYear: entry.academicYear,
        entryDate: entry.entryDate,
        dateOfCashDepositedWithdrawlDate:
          entry.dateOfCashDepositedWithdrawlDate,
        contraEntryName: entry.contraEntryName,
        narration: entry.narration,
        chequeImageForContra: entry.chequeImageForContra || null,
        contraVoucherNumber: entry.contraVoucherNumber || null,
        status: entry.status,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        subTotalOfDebit: entry.subTotalOfDebit,
        subTotalOfCredit: entry.subTotalOfCredit,
        totalAmountOfCredit: entry.totalAmountOfCredit,
        totalAmountOfDebit: entry.totalAmountOfDebit,

        itemDetails: itemsWithLedgerNames,
      };

      formattedData.push(entryData);
    }

    return res.status(200).json({
      hasError: false,
      message: "Entries fetched successfully",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching Entries:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
