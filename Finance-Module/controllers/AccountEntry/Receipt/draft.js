import moment from "moment";

import Receipt from "../../../models/Receipt.js";
import Ledger from "../../../models/Ledger.js";

async function generateReceiptVoucherNumber(schoolId, academicYear) {
  const count = await Receipt.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `RVN/${academicYear}/${nextNumber}`;
}

async function generateTransactionNumber() {
  const now = moment();
  const dateTimeStr = now.format("DDMMYYYYHHmmss");
  let baseTransactionNumber = `TRA-${dateTimeStr}`;
  let transactionNumber = baseTransactionNumber;
  let counter = 1;

  while (await PaymentEntry.exists({ transactionNumber })) {
    const suffix = String(counter).padStart(2, "0");
    transactionNumber = `${baseTransactionNumber}${suffix}`;
    counter++;
  }

  return transactionNumber;
}

async function draft(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const {
      entryDate,
      receiptDate,
      narration,
      paymentMode,
      chequeNumber,
      itemDetails,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      status,
      TDSTCSRateWithAmount,
      ledgerIdWithPaymentMode,
      academicYear,
      totalAmount,
    } = req.body;

    if (!academicYear || academicYear.trim() === "") {
      return res.status(400).json({
        hasError: true,
        message: "Academic year is required.",
      });
    }

    const receiptVoucherNumber = await generateReceiptVoucherNumber(
      schoolId,
      academicYear
    );

    const { receiptImage, chequeImage } = req.files || {};

    const receiptImagePath = receiptImage?.[0]?.mimetype?.startsWith("image/")
      ? "/Images/FinanceModule/ReceiptImage"
      : "/Documents/FinanceModule/ReceiptImage";

    const receiptImageFullPath = receiptImage?.[0]
      ? `${receiptImagePath}/${receiptImage[0].filename}`
      : null;

    const chequeImagePath = chequeImage?.[0]?.mimetype?.startsWith("image/")
      ? "/Images/FinanceModule/ChequeImage"
      : "/Documents/FinanceModule/ChequeImage";

    const chequeImageFullPath = chequeImage?.[0]
      ? `${chequeImagePath}/${chequeImage[0].filename}`
      : null;

    const updatedItemDetails = itemDetails.map((item) => {
      const amount = parseFloat(item.amount) || 0;
      return {
        ...item,
        amount,
      };
    });

    const subTotalAmount = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amount) || 0),
      0
    );

    const transactionNumber =
      paymentMode === "Online" ? await generateTransactionNumber() : null;

    // Automatically find TDS ledger if TDS is selected
    let TDSorTCSLedgerId = null;

    if (TDSorTCS === "TDS") {
      const tdsLedger = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: "TDS on Receipts",
      });
      if (tdsLedger) TDSorTCSLedgerId = tdsLedger._id;
    }
    const newReceipt = new Receipt({
      schoolId,
      academicYear,
      receiptVoucherNumber,
      entryDate,
      receiptDate,
      narration,
      paymentMode,
      chequeNumber,
      transactionNumber,
      itemDetails: updatedItemDetails,
      subTotalAmount,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      TDSTCSRateWithAmount: parseFloat(TDSTCSRateWithAmount) || 0,
      totalAmount,
      receiptImage: receiptImageFullPath,
      chequeImage: chequeImageFullPath,
      ledgerIdWithPaymentMode,
      status,
      TDSorTCSLedgerId,
    });

    await newReceipt.save();

    return res.status(201).json({
      hasError: false,
      message: "Receipt drafted successfully!",
      data: newReceipt,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Receipt already exists.`,
      });
    }

    console.error("Error drafting Receipt:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default draft;
