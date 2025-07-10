import moment from "moment";

import ReceiptEntry from "../../../models/Receipt.js";
import ReceiptValidator from "../../../validators/ReceiptValidator.js";

async function generateReceiptVoucherNumber(schoolId, academicYear) {
  const count = await ReceiptEntry.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `RVN/${academicYear}/${nextNumber}`;
}

async function generateTransactionNumber() {
  const now = moment();
  const dateTimeStr = now.format("DDMMYYYYHHmmss");
  let baseTransactionNumber = `TRA-${dateTimeStr}`;
  let transactionNumber = baseTransactionNumber;
  let counter = 1;

  while (await ReceiptEntry.exists({ transactionNumber })) {
    const suffix = String(counter).padStart(2, "0");
    transactionNumber = `${baseTransactionNumber}${suffix}`;
    counter++;
  }

  return transactionNumber;
}

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const { error } = ReceiptValidator.ReceiptValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const {
      receiptDate,
      narration,
      paymentMode,
      chequeNumber,
      itemDetails,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      adjustmentValue,
      status,
      TDSTCSRateWithAmount,
      ledgerIdWithPaymentMode,
      academicYear,
    } = req.body;

    const receiptVoucherNumber = await generateReceiptVoucherNumber(
      schoolId,
      academicYear
    );

    const { receiptImage, chequeImage } = req.files || {};

    if (!receiptImage?.[0]) {
      return res.status(400).json({
        hasError: true,
        message: "Receipt is required.",
      });
    }

    const receiptImagePath = receiptImage[0].mimetype.startsWith("image/")
      ? "/Images/FinanceModule/ReceiptImage"
      : "/Documents/FinanceModule/ReceiptImage";

    const receiptImageFullPath = `${receiptImagePath}/${receiptImage[0].filename}`;

    const chequeImagePath = chequeImage?.[0]?.mimetype.startsWith("image/")
      ? "/Images/FinanceModule/ChequeImage"
      : "/Documents/FinanceModule/ChequeImage";

    const chequeImageFullPath = chequeImage?.[0]
      ? `${chequeImagePath}/${chequeImage[0].filename}`
      : null;

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amount: parseFloat(item.amount) || 0,
    }));

    const subTotalAmount = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amount) || 0),
      0
    );

    const totalAmount =
      subTotalAmount -
      (parseFloat(TDSTCSRateWithAmount) || 0) +
      (parseFloat(adjustmentValue) || 0);

    const transactionNumber =
      paymentMode === "Online" ? await generateTransactionNumber() : null;

    const newReceipt = new Receipt({
      schoolId,
      receiptVoucherNumber,
      receiptDate,
      entryDate,
      narration,
      paymentMode,
      chequeNumber,
      transactionNumber,
      itemDetails: updatedItemDetails,
      subTotalAmount,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      TDSTCSRateWithAmount,
      adjustmentValue: parseFloat(adjustmentValue) || 0,
      totalAmount,
      receiptImage: receiptImageFullPath,
      chequeImage: chequeImageFullPath,
      ledgerIdWithPaymentMode,
      status,
      academicYear,
    });

    await newReceipt.save();

    return res.status(201).json({
      hasError: false,
      message: "Receipt created successfully!",
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

    console.error("Error creating Receipt:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
