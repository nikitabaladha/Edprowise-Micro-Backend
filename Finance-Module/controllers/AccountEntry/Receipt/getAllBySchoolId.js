import Receipt from "../../../models/Receipt.js";
import Ledger from "../../../models/Ledger.js";
import TDSTCSRateChart from "../../../models/TDSTCSRateChart.js";
import AuthorisedSignature from "../../../models/AuthorisedSignature.js";
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

    const authorisedSignature = await AuthorisedSignature.findOne({
      schoolId,
      academicYear,
    })
      .select("authorisedSignatureImage")
      .lean();

    const receipts = await Receipt.find({ schoolId, academicYear })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

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
          amount: item.amount,
        });
      }

      // Fetch TDS/TCS Rate Chart
      const tdsTcsRateChart =
        entry.TDSTCSRateChartId &&
        mongoose.Types.ObjectId.isValid(entry.TDSTCSRateChartId)
          ? await TDSTCSRateChart.findById(entry.TDSTCSRateChartId).lean()
          : null;

      // Fetch Ledger with Payment Mode
      const ledgerWithPaymentMode =
        entry.ledgerIdWithPaymentMode &&
        mongoose.Types.ObjectId.isValid(entry.ledgerIdWithPaymentMode)
          ? await Ledger.findById(entry.ledgerIdWithPaymentMode)
              .select("ledgerName")
              .lean()
          : null;

      const entryData = {
        // Receipt fields
        _id: entry._id,
        schoolId: entry.schoolId,
        entryDate: entry.entryDate,
        receiptDate: entry.receiptDate,
        narration: entry.narration,
        paymentMode: entry.paymentMode,
        chequeNumber: entry.chequeNumber || null,
        transactionNumber: entry.transactionNumber || null,
        subTotalAmount: entry.subTotalAmount,
        TDSorTCS: entry.TDSorTCS,
        TDSTCSRateChartId: entry.TDSTCSRateChartId,
        TDSTCSRate: entry.TDSTCSRate,
        TDSTCSRateWithAmount: entry.TDSTCSRateWithAmount,
        totalAmount: entry.totalAmount,
        receiptImage: entry.receiptImage,
        chequeImageForReceipt: entry.chequeImageForReceipt || null,
        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        status: entry.status || null,
        receiptVoucherNumber: entry.receiptVoucherNumber || null,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // Item details
        itemDetails: itemsWithLedgerNames,

        // TDS/TCS Rate Chart fields
        natureOfTransaction: tdsTcsRateChart?.natureOfTransaction || null,
        rate: tdsTcsRateChart?.rate || null,

        // Authorised Signature
        authorisedSignatureImage:
          authorisedSignature?.authorisedSignatureImage || null,
      };

      formattedData.push(entryData);
    }

    return res.status(200).json({
      hasError: false,
      message: "Receipts fetched successfully with ledger info.",
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

export default getAllBySchoolId;
