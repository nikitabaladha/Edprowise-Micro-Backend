import PaymentEntry from "../../../models/PaymentEntry.js";
import Vendor from "../../../models/Vendor.js";
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

    const paymentEntries = await PaymentEntry.find({
      schoolId,
      academicYear,
      customizeEntry: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    const formattedData = [];

    for (const entry of paymentEntries) {
      // Fetch Vendor
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
            .select("ledgerName")
            .lean();
        }

        itemsWithLedgerNames.push({
          itemName: item.itemName,
          ledgerId: item.ledgerId || null,
          ledgerName: ledger?.ledgerName || null,
          amountBeforeGST: item.amountBeforeGST,
          GSTAmount: item.GSTAmount,
          amountAfterGST: item.amountAfterGST,
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
        TDSorTCS: entry.TDSorTCS || null,
        TDSTCSRateChartId: entry.TDSTCSRateChartId,
        TDSTCSRate: entry.TDSTCSRate,
        TDSTCSRateWithAmountBeforeGST: entry.TDSTCSRateWithAmountBeforeGST,
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

        // Item details
        itemDetails: itemsWithLedgerNames,

        // TDS/TCS Rate Chart fields
        natureOfTransaction: tdsTcsRateChart?.natureOfTransaction || null,
        rate: tdsTcsRateChart?.rate || null,

        // Authorised Signature
        authorisedSignatureImage:
          authorisedSignature?.authorisedSignatureImage || null,
        academicYear: entry.academicYear,
        approvalStatus: entry.approvalStatus,
        reasonOfDisapprove: entry.reasonOfDisapprove,
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
