import mongoose from "mongoose";

import PaymentEntry from "../../models/PaymentEntry.js";
import Receipt from "../../models/Receipt.js";
import Contra from "../../models/Contra.js";
import Journal from "../../models/Journal.js";

import BSPLLedger from "../../models/BSPLLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";
import Ledger from "../../models/Ledger.js";
import GroupLedger from "../../models/GroupLedger.js";

import Vendor from "../../models/Vendor.js";
import TDSTCSRateChart from "../../models/TDSTCSRateChart.js";
import AuthorisedSignature from "../../models/AuthorisedSignature.js";

async function getAllBankBookBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { financialYear } = req.params;
    const { startDate, endDate } = req.query;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const authorisedSignature = await AuthorisedSignature.findOne({
      schoolId,
      financialYear,
    })
      .select("authorisedSignatureImage")
      .lean();

    // Create date filter object
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.entryDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (financialYear) {
      const yearParts = financialYear.split("-");
      if (yearParts.length === 2) {
        const startYear = parseInt(yearParts[0]);
        const endYear = parseInt(yearParts[1]);
        dateFilter.entryDate = {
          $gte: new Date(`${startYear}-04-01`),
          $lte: new Date(`${endYear}-03-31`),
        };
      }
    }

    const paymentEntries = await PaymentEntry.find({
      schoolId,
      ...dateFilter,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const receiptEntries = await Receipt.find({
      schoolId,
      ...dateFilter,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const contraEntries = await Contra.find({
      schoolId,
      ...dateFilter,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const JournalEntries = await Journal.find({
      schoolId,
      ...dateFilter,
      status: "Posted",
    })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

    // Find Payment Entries

    for (const entry of paymentEntries) {
      const vendor = entry.vendorCode
        ? await Vendor.findOne({
            vendorCode: entry.vendorCode,
            schoolId,
          }).lean()
        : null;

      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select(
              "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance balanceType"
            )
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

        const headOfAccount = ledger?.headOfAccountId
          ? await HeadOfAccount.findOne({ _id: ledger.headOfAccountId })
              .select("headOfAccountName")
              .lean()
          : null;

        const bsplLedger = ledger?.bSPLLedgerId
          ? await BSPLLedger.findOne({ _id: ledger.bSPLLedgerId })
              .select("bSPLLedgerName")
              .lean()
          : null;

        itemsWithLedgerNames.push({
          itemName: item.itemName || null,
          amountBeforeGST: item.amountBeforeGST || 0,
          GSTAmount: item.GSTAmount || 0,
          amountAfterGST: item.amountAfterGST || 0,
          creditAmount: item.creditAmount || 0,

          ledgerId: item.ledgerId || null,
          ledgerName: ledger?.ledgerName || null,
          openingBalance: ledger?.openingBalance || 0,
          balanceType: ledger?.balanceType || null,

          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,

          headOfAccountId: ledger?.headOfAccountId || null,
          headOfAccountName: headOfAccount?.headOfAccountName || null,

          bSPLLedgerId: ledger?.bSPLLedgerId || null,
          bSPLLedgerName: bsplLedger?.bSPLLedgerName || null,
        });
      }

      // Fetch TDS/TCS Rate Chart
      const tdsTcsRateChart =
        entry.TDSTCSRateChartId &&
        mongoose.Types.ObjectId.isValid(entry.TDSTCSRateChartId)
          ? await TDSTCSRateChart.findById(entry.TDSTCSRateChartId).lean()
          : null;

      const ledgerWithPaymentMode =
        entry.ledgerIdWithPaymentMode &&
        mongoose.Types.ObjectId.isValid(entry.ledgerIdWithPaymentMode)
          ? await Ledger.findById(entry.ledgerIdWithPaymentMode)
              .select(
                "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance balanceType"
              )
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

      const headOfAccountWithPaymentMode =
        ledgerWithPaymentMode?.headOfAccountId
          ? await HeadOfAccount.findOne({
              _id: ledgerWithPaymentMode.headOfAccountId,
            })
              .select("headOfAccountName")
              .lean()
          : null;

      const bsplLedgerWithPaymentMode = ledgerWithPaymentMode?.bSPLLedgerId
        ? await BSPLLedger.findOne({
            _id: ledgerWithPaymentMode.bSPLLedgerId,
          })
            .select("bSPLLedgerName")
            .lean()
        : null;

      let TDSorTCSGroupLedgerName = null;
      let TDSorTCSLedgerName = null;
      let TDSorTCSHeadOfAccountName = null;
      let TDSorTCSBSPLLedgerName = null;
      let TDSorTCSOpeningBalance = null;
      let TDSorTCSBalanceType = null;

      if (entry.TDSorTCS && entry.TDSorTCSLedgerId) {
        // Find the TDS/TCS Ledger using the stored ID
        const tdsOrTcsLedger = await Ledger.findOne({
          _id: entry.TDSorTCSLedgerId,
          schoolId,
        })
          .select(
            "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance balanceType"
          )
          .lean();

        if (tdsOrTcsLedger) {
          TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
          TDSorTCSOpeningBalance = tdsOrTcsLedger.openingBalance || null;
          TDSorTCSBalanceType = tdsOrTcsLedger.balanceType || null;

          // Find GroupLedger
          const tdsOrTcsGroupLedger = await GroupLedger.findOne({
            _id: tdsOrTcsLedger.groupLedgerId,
            schoolId,
          })
            .select("groupLedgerName")
            .lean();

          if (tdsOrTcsGroupLedger) {
            TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;
          }

          // Find HeadOfAccount
          const headOfAccount = tdsOrTcsLedger.headOfAccountId
            ? await HeadOfAccount.findOne({
                _id: tdsOrTcsLedger.headOfAccountId,
              })
                .select("headOfAccountName")
                .lean()
            : null;

          // Find BSPLLedger
          const bsplLedger = tdsOrTcsLedger.bSPLLedgerId
            ? await BSPLLedger.findOne({ _id: tdsOrTcsLedger.bSPLLedgerId })
                .select("bSPLLedgerName")
                .lean()
            : null;

          TDSorTCSHeadOfAccountName = headOfAccount?.headOfAccountName || null;
          TDSorTCSBSPLLedgerName = bsplLedger?.bSPLLedgerName || null;
        }
      }

      const entryData = {
        // PaymentEntry fields
        accountingEntry: "Payment",
        _id: entry._id,
        schoolId: entry.schoolId,
        invoiceNumber: entry.invoiceNumber,

        TDSTCSRateWithAmountBeforeGST: entry.TDSTCSRateWithAmountBeforeGST || 0,

        subTotalAmountAfterGST: entry.subTotalAmountAfterGST || 0,
        subTotalOfCredit: entry.subTotalOfCredit || 0,

        totalAmountAfterGST: entry.totalAmountAfterGST || 0,
        totalCreditAmount: entry.totalCreditAmount || 0,

        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,

        groupLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.groupLedgerId || null,
        groupLedgerNameWithPaymentMode:
          groupLedgerWithPaymentMode?.groupLedgerName || null,

        headOfAccountIdWithPaymentMode:
          ledgerWithPaymentMode?.headOfAccountId || null,
        headOfAccountNameWithPaymentMode:
          headOfAccountWithPaymentMode?.headOfAccountName || null,

        bSPLLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.bSPLLedgerId || null,
        bSPLLedgerNameWithPaymentMode:
          bsplLedgerWithPaymentMode?.bSPLLedgerName || null,

        openingBalanceWithPaymentMode:
          ledgerWithPaymentMode?.openingBalance || 0,
        balanceTypeWithPaymentMode: ledgerWithPaymentMode?.balanceType || null,

        TDSorTCS: entry.TDSorTCS || null,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,
        TDSorTCSHeadOfAccountName,
        TDSorTCSBSPLLedgerName,
        TDSorTCSOpeningBalance: TDSorTCSOpeningBalance || 0,
        TDSorTCSBalanceType: TDSorTCSBalanceType || null,

        // Item details
        itemDetails: itemsWithLedgerNames,

        entryDate: entry.entryDate,
        financialYear: entry.financialYear,

        invoiceDate: entry.invoiceDate,
        narration: entry.narration,
        chequeNumber: entry.chequeNumber || null,
        transactionNumber: entry.transactionNumber || null,
        paymentVoucherNumber: entry.paymentVoucherNumber || null,

        vendorCode: entry.vendorCode,
        vendorId: entry.vendorId,
        entryDate: entry.entryDate,
        invoiceDate: entry.invoiceDate,
        invoiceNumber: entry.invoiceNumber,
        poNumber: entry.poNumber,
        dueDate: entry.dueDate,
        paymentMode: entry.paymentMode,

        TDSTCSRateChartId: entry.TDSTCSRateChartId,
        TDSTCSRate: entry.TDSTCSRate,
        totalAmountBeforeGST: entry.totalAmountBeforeGST,
        totalGSTAmount: entry.totalGSTAmount,
        totalAmountAfterGST: entry.totalAmountAfterGST,
        invoiceImage: entry.invoiceImage,
        chequeImage: entry.chequeImage || null,
        status: entry.status || null,

        // Vendor fields
        nameOfVendor: vendor?.nameOfVendor || null,
        email: vendor?.email || null,
        contactNumber: vendor?.contactNumber || null,
        gstNumber: vendor?.gstNumber || null,
        panNumber: vendor?.panNumber || null,
        address: vendor?.address || null,
        state: vendor?.state || null,
        nameOfAccountHolder: vendor?.nameOfAccountHolder || null,
        nameOfBank: vendor?.nameOfBank || null,
        ifscCode: vendor?.ifscCode || null,
        accountNumber: vendor?.accountNumber || null,
        accountType: vendor?.accountType || null,

        // TDS/TCS Rate Chart fields
        natureOfTransaction: tdsTcsRateChart?.natureOfTransaction || null,
        rate: tdsTcsRateChart?.rate || null,

        // Authorised Signature
        authorisedSignatureImage:
          authorisedSignature?.authorisedSignatureImage || null,

        customizeEntry: entry.customizeEntry,
      };

      const hasBankInItems = itemsWithLedgerNames.some(
        (item) => item.groupLedgerName === "Bank"
      );

      if (
        hasBankInItems ||
        groupLedgerWithPaymentMode?.groupLedgerName === "Bank"
      ) {
        formattedData.push(entryData);
      }
    }

    // For Receipt Entries // Find Receipt Entries

    for (const entry of receiptEntries) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        let ledger = null;
        if (item.ledgerId && mongoose.Types.ObjectId.isValid(item.ledgerId)) {
          ledger = await Ledger.findOne({
            _id: item.ledgerId,
            schoolId,
          })
            .select(
              "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance balanceType"
            )
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

        const headOfAccount = ledger?.headOfAccountId
          ? await HeadOfAccount.findOne({ _id: ledger.headOfAccountId })
              .select("headOfAccountName")
              .lean()
          : null;

        const bsplLedger = ledger?.bSPLLedgerId
          ? await BSPLLedger.findOne({ _id: ledger.bSPLLedgerId })
              .select("bSPLLedgerName")
              .lean()
          : null;

        itemsWithLedgerNames.push({
          itemName: item.itemName,
          debitAmount: item.debitAmount || null,
          amount: item.amount,

          ledgerId: item.ledgerId || null,
          ledgerName: ledger?.ledgerName || null,

          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,

          headOfAccountId: ledger?.headOfAccountId || null,
          headOfAccountName: headOfAccount?.headOfAccountName || null,

          bSPLLedgerId: ledger?.bSPLLedgerId || null,
          bSPLLedgerName: bsplLedger?.bSPLLedgerName || null,

          openingBalance: ledger?.openingBalance || 0,
          balanceType: ledger?.balanceType || null,
        });
      }

      // Fetch TDS/TCS Rate Chart
      const tdsTcsRateChart =
        entry.TDSTCSRateChartId &&
        mongoose.Types.ObjectId.isValid(entry.TDSTCSRateChartId)
          ? await TDSTCSRateChart.findById(entry.TDSTCSRateChartId).lean()
          : null;

      const ledgerWithPaymentMode =
        entry.ledgerIdWithPaymentMode &&
        mongoose.Types.ObjectId.isValid(entry.ledgerIdWithPaymentMode)
          ? await Ledger.findById(entry.ledgerIdWithPaymentMode)
              .select(
                "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance balanceType"
              )
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

      const headOfAccountWithPaymentMode =
        ledgerWithPaymentMode?.headOfAccountId
          ? await HeadOfAccount.findOne({
              _id: ledgerWithPaymentMode.headOfAccountId,
            })
              .select("headOfAccountName")
              .lean()
          : null;

      const bsplLedgerWithPaymentMode = ledgerWithPaymentMode?.bSPLLedgerId
        ? await BSPLLedger.findOne({
            _id: ledgerWithPaymentMode.bSPLLedgerId,
          })
            .select("bSPLLedgerName")
            .lean()
        : null;

      let TDSorTCSGroupLedgerName = null;
      let TDSorTCSLedgerName = null;
      let TDSorTCSHeadOfAccountName = null;
      let TDSorTCSBSPLLedgerName = null;
      let TDSorTCSOpeningBalance = null;
      let TDSorTCSBalanceType = null;

      // Use the stored TDSorTCSLedgerId from Receipt table

      if (entry.TDSorTCS && entry.TDSorTCSLedgerId) {
        // Find the TDS/TCS Ledger using the stored ID
        const tdsOrTcsLedger = await Ledger.findOne({
          _id: entry.TDSorTCSLedgerId,
          schoolId,
        })
          .select(
            "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance balanceType"
          )
          .lean();

        if (tdsOrTcsLedger) {
          TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
          TDSorTCSOpeningBalance = tdsOrTcsLedger.openingBalance || null;
          TDSorTCSBalanceType = tdsOrTcsLedger.balanceType || null;

          // Find GroupLedger
          const tdsOrTcsGroupLedger = await GroupLedger.findOne({
            _id: tdsOrTcsLedger.groupLedgerId,
            schoolId,
          })
            .select("groupLedgerName")
            .lean();

          if (tdsOrTcsGroupLedger) {
            TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;
          }

          // Find HeadOfAccount
          const headOfAccount = tdsOrTcsLedger.headOfAccountId
            ? await HeadOfAccount.findOne({
                _id: tdsOrTcsLedger.headOfAccountId,
              })
                .select("headOfAccountName")
                .lean()
            : null;

          // Find BSPLLedger
          const bsplLedger = tdsOrTcsLedger.bSPLLedgerId
            ? await BSPLLedger.findOne({ _id: tdsOrTcsLedger.bSPLLedgerId })
                .select("bSPLLedgerName")
                .lean()
            : null;

          TDSorTCSHeadOfAccountName = headOfAccount?.headOfAccountName || null;
          TDSorTCSBSPLLedgerName = bsplLedger?.bSPLLedgerName || null;
        }
      }

      const entryData = {
        // Receipt fields
        accountingEntry: "Receipt",
        _id: entry._id,
        schoolId: entry.schoolId,

        TDSTCSRateWithAmount: entry.TDSTCSRateWithAmount || 0,

        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,

        groupLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.groupLedgerId || null,
        groupLedgerNameWithPaymentMode:
          groupLedgerWithPaymentMode?.groupLedgerName || null,

        headOfAccountIdWithPaymentMode:
          ledgerWithPaymentMode?.headOfAccountId || null,
        headOfAccountNameWithPaymentMode:
          headOfAccountWithPaymentMode?.headOfAccountName || null,

        bSPLLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.bSPLLedgerId || null,
        bSPLLedgerNameWithPaymentMode:
          bsplLedgerWithPaymentMode?.bSPLLedgerName || null,

        openingBalanceWithPaymentMode:
          ledgerWithPaymentMode?.openingBalance || null,
        balanceTypeWithPaymentMode: ledgerWithPaymentMode?.balanceType || null,

        TDSorTCS: entry.TDSorTCS || null,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,
        TDSorTCSHeadOfAccountName,
        TDSorTCSBSPLLedgerName,
        TDSorTCSOpeningBalance: TDSorTCSOpeningBalance || 0,
        TDSorTCSBalance: TDSorTCSBalanceType || null,

        // Item details
        itemDetails: itemsWithLedgerNames,

        entryDate: entry.entryDate,
        financialYear: entry.financialYear,

        receiptDate: entry.receiptDate,
        narration: entry.narration,
        chequeNumber: entry.chequeNumber || null,
        transactionNumber: entry.transactionNumber || null,

        receiptVoucherNumber: entry.receiptVoucherNumber || null,

        // ==============

        paymentMode: entry.paymentMode,
        TDSorTCS: entry.TDSorTCS || null,
        TDSTCSRateChartId: entry.TDSTCSRateChartId,
        TDSTCSRate: entry.TDSTCSRate,
        receiptImage: entry.receiptImage,
        chequeImageForReceipt: entry.chequeImageForReceipt || null,
        status: entry.status || null,

        // TDS/TCS Rate Chart fields
        natureOfTransaction: tdsTcsRateChart?.natureOfTransaction || null,
        rate: tdsTcsRateChart?.rate || null,

        // Authorised Signature
        authorisedSignatureImage:
          authorisedSignature?.authorisedSignatureImage || null,

        customizeEntry: entry.customizeEntry,

        subTotalAmount: entry.subTotalAmount || 0,
        subTotalOfDebit: entry.subTotalOfDebit || 0,
        totalAmount: entry.totalAmount || 0,
        totalDebitAmount: entry.totalDebitAmount || 0,
      };

      const hasBankInItems = itemsWithLedgerNames.some(
        (item) => item.groupLedgerName === "Bank"
      );

      if (
        hasBankInItems ||
        groupLedgerWithPaymentMode?.groupLedgerName === "Bank"
      ) {
        formattedData.push(entryData);
      }
    }

    // Find Contra Entries

    for (const entry of contraEntries) {
      const itemsWithLedgerNames = [];

      const allLedgerIds = new Set();
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

      // Fetch all required ledgers in one query
      const ledgers = await Ledger.find({
        _id: { $in: Array.from(allLedgerIds) },
        schoolId,
      })
        .select(
          "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance balanceType"
        )
        .lean();

      const headOfAccountIds = new Set();
      const bsplLedgerIds = new Set();

      ledgers.forEach((ledger) => {
        if (ledger.headOfAccountId)
          headOfAccountIds.add(ledger.headOfAccountId);
        if (ledger.bSPLLedgerId) bsplLedgerIds.add(ledger.bSPLLedgerId);
      });

      const headOfAccounts = await HeadOfAccount.find({
        _id: { $in: Array.from(headOfAccountIds) },
      }).lean();

      const bsplLedgers = await BSPLLedger.find({
        _id: { $in: Array.from(bsplLedgerIds) },
      }).lean();

      const headOfAccountMap = {};
      headOfAccounts.forEach((hoa) => {
        headOfAccountMap[hoa._id.toString()] = hoa.headOfAccountName;
      });

      const bsplLedgerMap = {};
      bsplLedgers.forEach((bspl) => {
        bsplLedgerMap[bspl._id.toString()] = bspl.bSPLLedgerName;
      });

      // Create maps for quick lookup

      const ledgerMap = {};
      const ledgerGroupMap = {};

      ledgers.forEach((ledger) => {
        ledgerMap[ledger._id.toString()] = {
          ledgerName: ledger.ledgerName,
          groupLedgerId: ledger.groupLedgerId?.toString(),
          headOfAccountName: ledger.headOfAccountId
            ? headOfAccountMap[ledger.headOfAccountId.toString()]
            : null,
          bSPLLedgerName: ledger.bSPLLedgerId
            ? bsplLedgerMap[ledger.bSPLLedgerId.toString()]
            : null,

          openingBalance: ledger.openingBalance,
          balanceType: ledger.balanceType,
        };
      });

      const groupLedgerIds = new Set(
        ledgers
          .map((ledger) => ledger.groupLedgerId?.toString())
          .filter((id) => id)
      );

      const groupLedgers = await GroupLedger.find({
        _id: { $in: Array.from(groupLedgerIds) },
        schoolId,
      })
        .select("groupLedgerName")
        .lean();

      const groupLedgerMap = {};
      groupLedgers.forEach((groupLedger) => {
        groupLedgerMap[groupLedger._id.toString()] =
          groupLedger.groupLedgerName;
      });

      for (const item of entry.itemDetails) {
        const ledgerInfo = ledgerMap[item.ledgerId?.toString()] || {};
        const cashLedgerInfo =
          ledgerMap[item.ledgerIdOfCashAccount?.toString()] || {};

        itemsWithLedgerNames.push({
          ledgerId: item.ledgerId || null,
          ledgerName: ledgerInfo.ledgerName || null,

          groupLedgerId: ledgerInfo.groupLedgerId || null,
          groupLedgerName: ledgerInfo.groupLedgerId
            ? groupLedgerMap[ledgerInfo.groupLedgerId]
            : null,

          // Add these for the main ledger
          headOfAccountName: ledgerInfo.headOfAccountName || null,
          bSPLLedgerName: ledgerInfo.bSPLLedgerName || null,

          ledgerIdOfCashAccount: item.ledgerIdOfCashAccount || null,
          ledgerNameOfCashAccount: cashLedgerInfo.ledgerName || null,

          groupLedgerIdOfCashAccount: cashLedgerInfo.groupLedgerId || null,
          groupLedgerNameOfCashAccount: cashLedgerInfo.groupLedgerId
            ? groupLedgerMap[cashLedgerInfo.groupLedgerId]
            : null,

          // Add these for the cash account ledger
          headOfAccountNameOfCashAccount:
            cashLedgerInfo.headOfAccountName || null,
          bSPLLedgerNameOfCashAccount: cashLedgerInfo.bSPLLedgerName || null,

          openingBalance: ledgerInfo.openingBalance || null,
          balanceType: ledgerInfo.balanceType || null,

          openingBalanceOfCashAccount: cashLedgerInfo.openingBalance || null,
          balanceTypeOfCashAccount: cashLedgerInfo.balanceType || null,

          debitAmount: item.debitAmount || 0,
          creditAmount: item.creditAmount || 0,
        });
      }

      let TDSorTCSGroupLedgerName = null;
      let TDSorTCSLedgerName = null;
      let TDSorTCSHeadOfAccountName = null;
      let TDSorTCSBSPLLedgerName = null;
      let TDSorTCSOpeningBalance = null;
      let TDSorTCSBalanceType = null;

      // Use the stored TDSorTCSLedgerId from Receipt table

      if (entry.TDSorTCS && entry.TDSorTCSLedgerId) {
        // Find the TDS/TCS Ledger using the stored ID
        const tdsOrTcsLedger = await Ledger.findOne({
          _id: entry.TDSorTCSLedgerId,
          schoolId,
        })
          .select(
            "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance balanceType"
          )
          .lean();

        if (tdsOrTcsLedger) {
          TDSorTCSLedgerName = tdsOrTcsLedger.ledgerName;
          TDSorTCSOpeningBalance = tdsOrTcsLedger.openingBalance || null;
          TDSorTCSBalanceType = tdsOrTcsLedger.balanceType || null;

          // Find GroupLedger
          const tdsOrTcsGroupLedger = await GroupLedger.findOne({
            _id: tdsOrTcsLedger.groupLedgerId,
            schoolId,
          })
            .select("groupLedgerName")
            .lean();

          if (tdsOrTcsGroupLedger) {
            TDSorTCSGroupLedgerName = tdsOrTcsGroupLedger.groupLedgerName;
          }

          // Find HeadOfAccount
          const headOfAccount = tdsOrTcsLedger.headOfAccountId
            ? await HeadOfAccount.findOne({
                _id: tdsOrTcsLedger.headOfAccountId,
              })
                .select("headOfAccountName")
                .lean()
            : null;

          // Find BSPLLedger
          const bsplLedger = tdsOrTcsLedger.bSPLLedgerId
            ? await BSPLLedger.findOne({ _id: tdsOrTcsLedger.bSPLLedgerId })
                .select("bSPLLedgerName")
                .lean()
            : null;

          TDSorTCSHeadOfAccountName = headOfAccount?.headOfAccountName || null;
          TDSorTCSBSPLLedgerName = bsplLedger?.bSPLLedgerName || null;
        }
      }

      const entryData = {
        accountingEntry: "Contra",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        dateOfCashDepositedWithdrawlDate:
          entry.dateOfCashDepositedWithdrawlDate,
        contraEntryName: entry.contraEntryName,
        narration: entry.narration,
        chequeNumber: entry.chequeNumber || null,
        chequeImageForContra: entry.chequeImageForContra || null,
        contraVoucherNumber: entry.contraVoucherNumber || null,

        subTotalOfDebit: entry.subTotalOfDebit || 0,
        subTotalOfCredit: entry.subTotalOfCredit || 0,
        totalAmountOfCredit: entry.totalAmountOfCredit || 0,
        totalAmountOfDebit: entry.totalAmountOfDebit || 0,
        TDSTCSRateAmount: entry.TDSTCSRateAmount || 0,
        TDSorTCS: entry.TDSorTCS || null,

        status: entry.status,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        itemDetails: itemsWithLedgerNames,

        entryDate: entry.entryDate,
        financialYear: entry.financialYear,

        TDSorTCSHeadOfAccountName,
        TDSorTCSBSPLLedgerName,
        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,

        TDSorTCSOpeningBalance: TDSorTCSOpeningBalance || null,
        TDSorTCSBalanceType: TDSorTCSBalanceType || null,

        customizeEntry: entry.customizeEntry,
      };

      const hasBankInItems = itemsWithLedgerNames.some(
        (item) =>
          item.groupLedgerName === "Bank" ||
          item.groupLedgerNameOfCashAccount === "Bank"
      );

      if (hasBankInItems) {
        formattedData.push(entryData);
      }
    }

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
            .select(
              "ledgerName groupLedgerId headOfAccountId bSPLLedgerId openingBalance balanceType"
            )
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

        const headOfAccount = ledger?.headOfAccountId
          ? await HeadOfAccount.findOne({ _id: ledger.headOfAccountId })
              .select("headOfAccountName")
              .lean()
          : null;

        const bsplLedger = ledger?.bSPLLedgerId
          ? await BSPLLedger.findOne({ _id: ledger.bSPLLedgerId })
              .select("bSPLLedgerName")
              .lean()
          : null;

        itemsWithLedgerNames.push({
          description: item.description,
          debitAmount: item.debitAmount || 0,
          creditAmount: item.creditAmount || 0,

          ledgerId: item.ledgerId || null,
          ledgerName: ledger?.ledgerName || null,

          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,

          headOfAccountId: ledger?.headOfAccountId || null,
          headOfAccountName: headOfAccount?.headOfAccountName || null,

          bSPLLedgerId: ledger?.bSPLLedgerId || null,
          bSPLLedgerName: bsplLedger?.bSPLLedgerName || null,

          openingBalance: ledger?.openingBalance || null,
          balanceType: ledger?.balanceType || null,
        });
      }

      const entryData = {
        accountingEntry: "Journal",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        documentDate: entry.documentDate,
        journalVoucherNumber: entry.journalVoucherNumber || null,
        narration: entry.narration,

        subTotalOfDebit: entry.subTotalOfDebit || 0,
        totalAmountOfDebit: entry.totalAmountOfDebit || 0,
        totalAmountOfCredit: entry.totalAmountOfCredit || 0,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // Item details
        itemDetails: itemsWithLedgerNames,

        entryDate: entry.entryDate,
        financialYear: entry.financialYear,

        customizeEntry: entry.customizeEntry,
      };

      const hasBankInItems = itemsWithLedgerNames.some(
        (item) => item.groupLedgerName === "Bank"
      );

      if (hasBankInItems) {
        formattedData.push(entryData);
      }
    }

    return res.status(200).json({
      hasError: false,
      message: "Entries fetched successfully with vendor and ledger info.",
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

export default getAllBankBookBySchoolId;
