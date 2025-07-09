import PaymentEntry from "../../../models/PaymentEntry.js";
import Vendor from "../../../models/Vendor.js";
import Ledger from "../../../models/Ledger.js";
import TDSTCSRateChart from "../../../models/TDSTCSRateChart.js";

// i have store ledgerIdWithPaymentMode on the basis of that id i want to fetch ledgerName
// and want ledgerNameWithPaymentMode to in response data

async function getAllBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    // Get all payment entries for the school
    const paymentEntries = await PaymentEntry.find({ schoolId })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

    for (const entry of paymentEntries) {
      const vendor = await Vendor.findOne({
        vendorCode: entry.vendorCode,
        schoolId,
      }).lean();

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
          amountBeforeGST: item.amountBeforeGST,
          GSTAmount: item.GSTAmount,
          amountAfterGST: item.amountAfterGST,
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
        // PaymentEntry fields
        _id: entry._id,
        schoolId: entry.schoolId,
        vendorCode: entry.vendorCode,
        vendorId: entry.vendorId,
        entryDate: entry.entryDate,
        invoiceDate: entry.invoiceDate,
        invoiceNumber: entry.invoiceNumber,
        poNumber: entry.poNumber,
        dueDate: entry.dueDate,
        narration: entry.narration,
        paymentMode: entry.paymentMode,
        chequeNumber: entry.chequeNumber || null,
        transactionNumber: entry.transactionNumber || null,
        subTotalAmountAfterGST: entry.subTotalAmountAfterGST,
        TDSorTCS: entry.TDSorTCS,
        TDSTCSRateChartId: entry.TDSTCSRateChartId,
        TDSTCSRate: entry.TDSTCSRate,
        TDSTCSRateWithAmountBeforeGST: entry.TDSTCSRateWithAmountBeforeGST,
        adjustmentValue: entry.adjustmentValue,
        totalAmountBeforeGST: entry.totalAmountBeforeGST,
        totalGSTAmount: entry.totalGSTAmount,
        totalAmountAfterGST: entry.totalAmountAfterGST,
        invoiceImage: entry.invoiceImage,
        chequeImage: entry.chequeImage || null,
        ledgerIdWithPaymentMode: entry.ledgerIdWithPaymentMode || null,
        ledgerNameWithPaymentMode: ledgerWithPaymentMode?.ledgerName || null,
        status: entry.status || null,
        paymentVoucherNumber: entry.paymentVoucherNumber || null,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,

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

        // Item details array
        itemDetails: itemsWithLedgerNames,

        // TDS/TCS Rate Chart details
        natureOfTransaction: tdsTcsRateChart?.natureOfTransaction || null,
        rate: tdsTcsRateChart?.rate || null,
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
