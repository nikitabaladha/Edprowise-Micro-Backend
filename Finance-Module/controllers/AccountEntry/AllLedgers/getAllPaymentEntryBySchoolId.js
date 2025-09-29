import mongoose from "mongoose";

import PaymentEntry from "../../../models/PaymentEntry.js";

import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

import Vendor from "../../../models/Vendor.js";
import TDSTCSRateChart from "../../../models/TDSTCSRateChart.js";
import AuthorisedSignature from "../../../models/AuthorisedSignature.js";

async function getAllBySchoolId(req, res) {
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

    const authorisedSignature = await AuthorisedSignature.findOne({
      schoolId,
      academicYear,
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

    const paymentEntries = await PaymentEntry.find({
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
          creditAmount: item.creditAmount || null,
          ledgerName: ledger?.ledgerName || null,
          groupLedgerId: ledger?.groupLedgerId || null,
          groupLedgerName: groupLedger?.groupLedgerName || null,
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
        accountingEntry: "Payment",
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        invoiceDate: entry.invoiceDate,

        invoiceNumber: entry.invoiceNumber,
        narration: entry.narration,
        chequeNumber: entry.chequeNumber || null,
        transactionNumber: entry.transactionNumber || null,
        TDSTCSRateWithAmountBeforeGST: entry.TDSTCSRateWithAmountBeforeGST,
        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        groupLedgerIdWithPaymentMode:
          ledgerWithPaymentMode?.groupLedgerId || null,
        groupLedgerNameWithPaymentMode:
          groupLedgerWithPaymentMode?.groupLedgerName || null,
        paymentVoucherNumber: entry.paymentVoucherNumber || null,
        TDSorTCS: entry.TDSorTCS || null,
        paymentMode: entry.paymentMode,

        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        TDSorTCSGroupLedgerName,
        TDSorTCSLedgerName,

        // Item details
        itemDetails: itemsWithLedgerNames,
        customizeEntry: entry.customizeEntry,

        subTotalAmountAfterGST: entry.subTotalAmountAfterGST,
        subTotalOfCredit: entry.subTotalOfCredit,

        totalAmountAfterGST: entry.totalAmountAfterGST,
        totalCreditAmount: entry.totalCreditAmount,

        // Vendor fields
        vendorCode: entry.vendorCode,
        vendorId: entry.vendorId,

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

        // Authorised Signature
        authorisedSignatureImage:
          authorisedSignature?.authorisedSignatureImage || null,

        customizeEntry: entry.customizeEntry,

        TDSTCSRateChartId: entry.TDSTCSRateChartId,
        TDSTCSRate: entry.TDSTCSRate,
        totalAmountBeforeGST: entry.totalAmountBeforeGST,
        totalGSTAmount: entry.totalGSTAmount,
        invoiceImage: entry.invoiceImage,
        chequeImage: entry.chequeImage || null,

        // TDS/TCS Rate Chart fields
        natureOfTransaction: tdsTcsRateChart?.natureOfTransaction || null,
        rate: tdsTcsRateChart?.rate || null,

        status: entry.status || null,
      };

      formattedData.push(entryData);
    }

    return res.status(200).json({
      hasError: false,
      message:
        "Payment entries fetched successfully with vendor and ledger info.",
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
