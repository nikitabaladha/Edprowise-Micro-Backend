import moment from "moment";
import Receipt from "../../../models/Receipt.js";
import ReceiptValidator from "../../../validators/ReceiptValidator.js";

async function generateTransactionNumber() {
  const now = moment();
  const dateTimeStr = now.format("DDMMYYYYHHmmss");
  let baseTransactionNumber = `TRA-${dateTimeStr}`;
  let transactionNumber = baseTransactionNumber;
  let counter = 1;

  while (await Receipt.exists({ transactionNumber })) {
    const suffix = String(counter).padStart(2, "0");
    transactionNumber = `${baseTransactionNumber}${suffix}`;
    counter++;
  }

  return transactionNumber;
}

async function updateById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id, academicYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const { error } = ReceiptValidator.ReceiptValidatorUpdate.validate(
      req.body
    );
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
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
      TDSTCSRateWithAmount,
      ledgerIdWithPaymentMode,
      status,
    } = req.body;

    const existingReceipt = await Receipt.findOne({
      _id: id,
      schoolId,
      academicYear,
    });
    if (!existingReceipt) {
      return res.status(404).json({
        hasError: true,
        message: "Receipt not found.",
      });
    }

    // Handle uploaded files (if provided)
    const { receiptImage, chequeImageForReceipt } = req.files || {};

    if (receiptImage?.[0]) {
      const receiptImagePath = receiptImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/ReceiptImage"
        : "/Documents/FinanceModule/ReceiptImage";
      existingReceipt.receiptImage = `${receiptImagePath}/${receiptImage[0].filename}`;
    }

    if (chequeImageForReceipt?.[0]) {
      const chequeImageForReceiptPath =
        chequeImageForReceipt[0].mimetype.startsWith("image/")
          ? "/Images/FinanceModule/ChequeImageForReceipt"
          : "/Documents/FinanceModule/ChequeImageForReceipt";
      existingReceipt.chequeImageForReceipt = `${chequeImageForReceiptPath}/${chequeImageForReceipt[0].filename}`;
    }

    // Recalculate item details amounts
    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amount: parseFloat(item.amount) || 0,
    }));

    const subTotalAmount = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amount) || 0),
      0
    );

    const parsedTDSTCSRateWithAmount = parseFloat(TDSTCSRateWithAmount) || 0;

    const totalAmount = subTotalAmount - parsedTDSTCSRateWithAmount;

    // Update fields
    existingReceipt.entryDate = entryDate || existingReceipt.entryDate;
    existingReceipt.receiptDate = receiptDate || existingReceipt.receiptDate;
    existingReceipt.narration = narration || existingReceipt.narration;
    existingReceipt.paymentMode = paymentMode || existingReceipt.paymentMode;
    existingReceipt.chequeNumber = chequeNumber || existingReceipt.chequeNumber;
    existingReceipt.itemDetails = updatedItemDetails;
    existingReceipt.TDSorTCS = TDSorTCS || existingReceipt.TDSorTCS;
    existingReceipt.TDSTCSRateChartId =
      TDSTCSRateChartId || existingReceipt.TDSTCSRateChartId;
    existingReceipt.TDSTCSRate = TDSTCSRate || existingReceipt.TDSTCSRate;
    existingReceipt.TDSTCSRateWithAmount = parsedTDSTCSRateWithAmount;
    existingReceipt.subTotalAmount = subTotalAmount;
    existingReceipt.totalAmount = totalAmount;
    existingReceipt.ledgerIdWithPaymentMode =
      ledgerIdWithPaymentMode || existingReceipt.ledgerIdWithPaymentMode;
    existingReceipt.status = status || existingReceipt.status;

    if (paymentMode === "Online" && !existingReceipt.transactionNumber) {
      existingReceipt.transactionNumber = await generateTransactionNumber();
    }

    await existingReceipt.save();

    return res.status(200).json({
      hasError: false,
      message: "Receipt updated successfully!",
      data: existingReceipt,
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

    console.error("Error updating Receipt Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
