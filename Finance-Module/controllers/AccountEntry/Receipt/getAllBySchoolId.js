import Receipt from "../../../models/Receipt.js";
import Ledger from "../../../models/Ledger.js";
import TDSTCSRateChart from "../../../models/TDSTCSRateChart.js";
import AuthorisedSignature from "../../../models/AuthorisedSignature.js";

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

    const paymentEntries = await Receipt.find({ schoolId, academicYear })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

    for (const entry of paymentEntries) {
      const itemsWithLedgerNames = [];

      for (const item of entry.itemDetails) {
        const ledger = await Ledger.findOne({
          _id: item.ledgerId,
          schoolId,
        })
          .select("ledgerName")
          .lean();

        itemsWithLedgerNames.push({
          itemName: item.itemName,
          ledgerId: item.ledgerId,
          ledgerName: ledger?.ledgerName || null,
          amount: item.amount,
        });
      }

      const tdsTcsRateChart = entry.TDSTCSRateChartId
        ? await TDSTCSRateChart.findById(entry.TDSTCSRateChartId).lean()
        : null;

      const ledgerWithPaymentMode = entry.ledgerIdWithPaymentMode
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
        adjustmentValue: entry.adjustmentValue,
        totalAmount: entry.totalAmount,
        receiptImage: entry.invoiceImage,
        chequeImage: entry.chequeImage || null,
        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        status: entry.status || null,
        receiptVoucherNumber: entry.receiptVoucherNumber || null,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

        // Item details array
        itemDetails: itemsWithLedgerNames,

        // TDS/TCS Rate Chart details
        natureOfTransaction: tdsTcsRateChart?.natureOfTransaction || null,
        rate: tdsTcsRateChart?.rate || null,

        authorisedSignatureImage:
          authorisedSignature?.authorisedSignatureImage || null,
      };

      formattedData.push(entryData);
    }

    return res.status(200).json({
      hasError: false,
      message: "Receipts fetched successfully with vendor and ledger info.",
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
