import PaymentEntry from "../../../models/PaymentEntry.js";
import Receipt from "../../../models/Receipt.js";
import Contra from "../../../models/Contra.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";
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

    const paymentEntries = await PaymentEntry.find({ schoolId, academicYear })
      .sort({ createdAt: -1 })
      .lean();

    const receiptEntries = await Receipt.find({ schoolId, academicYear })
      .sort({ createdAt: -1 })
      .lean();

    const contraEntries = await Contra.find({ schoolId, academicYear })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

    // Find Payment Entries

    for (const entry of paymentEntries) {
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
          amountBeforeGST: item.amountBeforeGST,
          GSTAmount: item.GSTAmount,
          amountAfterGST: item.amountAfterGST,
          ledgerName: ledger?.ledgerName || null,
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

      if (entry.TDSorTCS) {
        // 1. Find GroupLedger by name
        const tdsOrTcsGroupLedger = await GroupLedger.findOne({
          schoolId,
          groupLedgerName: entry.TDSorTCS,
        })
          .select("_id groupLedgerName")
          .lean();

        if (tdsOrTcsGroupLedger) {
          TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;

          // 2. Find Ledger under that GroupLedger
          const tdsOrTcsLedger = await Ledger.findOne({
            schoolId,
            groupLedgerId: tdsOrTcsGroupLedger._id,
          })
            .select("ledgerName")
            .lean();

          if (tdsOrTcsLedger) {
            TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
          }
        }
      }

      const entryData = {
        // PaymentEntry fields
        accountingEntry: "Payment",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        invoiceDate: entry.invoiceDate,
        narration: entry.narration,
        chequeNumber: entry.chequeNumber || null,
        transactionNumber: entry.transactionNumber || null,
        subTotalAmountAfterGST: entry.subTotalAmountAfterGST,
        TDSTCSRateWithAmountBeforeGST: entry.TDSTCSRateWithAmountBeforeGST,
        totalAmountAfterGST: entry.totalAmountAfterGST,
        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        groupLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.groupLedgerId || null,
        groupLedgerNameWithPaymentMode:
          groupLedgerWithPaymentMode?.groupLedgerName || null,
        paymentVoucherNumber: entry.paymentVoucherNumber || null,
        TDSorTCS: entry.TDSorTCS,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,

        // Item details
        itemDetails: itemsWithLedgerNames,
      };

      formattedData.push(entryData);
    }

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
          amount: item.amount,
          ledgerName: ledger?.ledgerName || null,
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

      if (entry.TDSorTCS) {
        // 1. Find GroupLedger by name
        const tdsOrTcsGroupLedger = await GroupLedger.findOne({
          schoolId,
          groupLedgerName: entry.TDSorTCS,
        })
          .select("_id groupLedgerName")
          .lean();

        if (tdsOrTcsGroupLedger) {
          TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;

          // 2. Find Ledger under that GroupLedger
          const tdsOrTcsLedger = await Ledger.findOne({
            schoolId,
            groupLedgerId: tdsOrTcsGroupLedger._id,
          })
            .select("ledgerName")
            .lean();

          if (tdsOrTcsLedger) {
            TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
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
        subTotalAmount: entry.subTotalAmount,
        TDSTCSRateWithAmount: entry.TDSTCSRateWithAmount,

        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        groupLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.groupLedgerId || null,
        groupLedgerNameWithPaymentMode:
          groupLedgerWithPaymentMode?.groupLedgerName || null,
        receiptVoucherNumber: entry.receiptVoucherNumber || null,
        TDSorTCS: entry.TDSorTCS,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,

        // Item details
        itemDetails: itemsWithLedgerNames,
      };

      formattedData.push(entryData);
    }

    // Find Contra Entries

    for (const entry of contraEntries) {
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

        let ledgerOfCashAccount = null;
        if (
          item.ledgerIdOfCashAccount &&
          mongoose.Types.ObjectId.isValid(item.ledgerIdOfCashAccount)
        ) {
          ledgerOfCashAccount = await Ledger.findOne({
            _id: item.ledgerIdOfCashAccount,
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

        let groupLedgerOfCashAccount = null;
        if (ledgerOfCashAccount?.groupLedgerId) {
          groupLedgerOfCashAccount = await GroupLedger.findOne({
            _id: ledgerOfCashAccount.groupLedgerId,
            schoolId,
          })
            .select("groupLedgerName")
            .lean();
        }

        itemsWithLedgerNames.push({
          ledgerId: item.ledgerId || null,
          ledgerName: ledger?.ledgerName || null,

          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,

          ledgerIdOfCashAccount: item.ledgerIdOfCashAccount || null,
          ledgerNameOfCashAccount: ledgerOfCashAccount?.ledgerName || null,

          groupLedgerIdOfCashAccount:
            ledgerOfCashAccount?.groupLedgerId || null,
          groupLedgerNameOfCashAccount:
            groupLedgerOfCashAccount?.groupLedgerName || null,

          debitAmount: item.debitAmount || 0,
          creditAmount: item.creditAmount || 0,
        });
      }

      let TDSorTCSGroupLedgerName = null;
      let TDSorTCSLedgerName = null;

      if (entry.TDSorTCS) {
        const tdsOrTcsGroupLedger = await GroupLedger.findOne({
          schoolId,
          groupLedgerName: entry.TDSorTCS,
        })
          .select("_id groupLedgerName")
          .lean();

        if (tdsOrTcsGroupLedger) {
          TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;

          const tdsOrTcsLedger = await Ledger.findOne({
            schoolId,
            groupLedgerId: tdsOrTcsGroupLedger._id,
          })
            .select("ledgerName")
            .lean();

          if (tdsOrTcsLedger) {
            TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
          }
        }
      }

      const entryData = {
        accountingEntry: "Contra",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        dateOfCashDepositedWithdrawlDate:
          entry.dateOfCashDepositedWithdrawlDate,
        narration: entry.narration,
        chequeNumber: entry.chequeNumber || null,
        subTotalOfDebit: entry.subTotalOfDebit,
        subTotalOfCredit: entry.subTotalOfCredit,
        totalAmountOfCredit: entry.totalAmountOfCredit,
        totalAmountOfDebit: entry.totalAmountOfDebit,
        TDSTCSRateAmount: entry.TDSTCSRateAmount,
        contraVoucherNumber: entry.contraVoucherNumber || null,
        TDSorTCS: entry.TDSorTCS,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,

        itemDetails: itemsWithLedgerNames,
      };

      formattedData.push(entryData);
    }

    return res.status(200).json({
      hasError: false,
      message: "Entries fetched successfully with vendor and ledger info.",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching paymentEntries:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllBySchoolId;
