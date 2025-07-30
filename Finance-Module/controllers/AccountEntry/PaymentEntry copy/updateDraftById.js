import moment from "moment";
import PaymentEntry from "../../../models/PaymentEntry.js";

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

    const {
      vendorCode,
      vendorId,
      entryDate,
      invoiceDate,
      invoiceNumber,
      poNumber,
      dueDate,
      narration,
      paymentMode,
      chequeNumber,
      itemDetails,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      TDSTCSRateWithAmountBeforeGST,
      ledgerIdWithPaymentMode,
      status,
    } = req.body;

    const existingPaymentEntry = await PaymentEntry.findOne({
      _id: id,
      schoolId,
      academicYear,
    });
    if (!existingPaymentEntry) {
      return res.status(404).json({
        hasError: true,
        message: "PaymentEntry not found.",
      });
    }

    // Handle uploaded files (if provided)
    const { invoiceImage, chequeImage } = req.files || {};

    if (invoiceImage?.[0]) {
      const invoiceImagePath = invoiceImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/InvoiceImage"
        : "/Documents/FinanceModule/InvoiceImage";
      existingPaymentEntry.invoiceImage = `${invoiceImagePath}/${invoiceImage[0].filename}`;
    }

    if (chequeImage?.[0]) {
      const chequeImagePath = chequeImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/ChequeImage"
        : "/Documents/FinanceModule/ChequeImage";
      existingPaymentEntry.chequeImage = `${chequeImagePath}/${chequeImage[0].filename}`;
    }

    // Recalculate item details amounts
    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amountBeforeGST: parseFloat(item.amountBeforeGST) || 0,
      GSTAmount: parseFloat(item.GSTAmount) || 0,
      amountAfterGST:
        (parseFloat(item.amountBeforeGST) || 0) +
        (parseFloat(item.GSTAmount) || 0),
    }));

    const totalAmountBeforeGST = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amountBeforeGST) || 0),
      0
    );

    const totalGSTAmount = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.GSTAmount) || 0),
      0
    );

    const subTotalAmountAfterGST = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amountAfterGST) || 0),
      0
    );

    const parsedTDSTCSRateWithAmountBeforeGST =
      parseFloat(TDSTCSRateWithAmountBeforeGST) || 0;

    const totalAmountAfterGST =
      subTotalAmountAfterGST - parsedTDSTCSRateWithAmountBeforeGST;

    // Update fields
    existingPaymentEntry.vendorCode =
      vendorCode || existingPaymentEntry.vendorCode;
    existingPaymentEntry.vendorId = vendorId || existingPaymentEntry.vendorId;
    existingPaymentEntry.entryDate =
      entryDate || existingPaymentEntry.entryDate;
    existingPaymentEntry.invoiceDate =
      invoiceDate || existingPaymentEntry.invoiceDate;
    existingPaymentEntry.invoiceNumber =
      invoiceNumber || existingPaymentEntry.invoiceNumber;
    existingPaymentEntry.poNumber = poNumber || existingPaymentEntry.poNumber;
    existingPaymentEntry.dueDate = dueDate || existingPaymentEntry.dueDate;
    existingPaymentEntry.narration =
      narration || existingPaymentEntry.narration;
    existingPaymentEntry.paymentMode =
      paymentMode || existingPaymentEntry.paymentMode;
    existingPaymentEntry.chequeNumber =
      chequeNumber || existingPaymentEntry.chequeNumber;
    existingPaymentEntry.itemDetails = updatedItemDetails;
    existingPaymentEntry.TDSorTCS = TDSorTCS || existingPaymentEntry.TDSorTCS;
    existingPaymentEntry.TDSTCSRateChartId =
      TDSTCSRateChartId || existingPaymentEntry.TDSTCSRateChartId;
    existingPaymentEntry.TDSTCSRate =
      TDSTCSRate || existingPaymentEntry.TDSTCSRate;
    existingPaymentEntry.TDSTCSRateWithAmountBeforeGST =
      parsedTDSTCSRateWithAmountBeforeGST;
    existingPaymentEntry.subTotalAmountAfterGST = subTotalAmountAfterGST;
    existingPaymentEntry.totalAmountBeforeGST = totalAmountBeforeGST;
    existingPaymentEntry.totalGSTAmount = totalGSTAmount;
    existingPaymentEntry.totalAmountAfterGST = totalAmountAfterGST;
    existingPaymentEntry.ledgerIdWithPaymentMode =
      ledgerIdWithPaymentMode || existingPaymentEntry.ledgerIdWithPaymentMode;
    existingPaymentEntry.status = status || existingPaymentEntry.status;

    if (paymentMode === "Online" && !existingPaymentEntry.transactionNumber) {
      existingPaymentEntry.transactionNumber =
        await generateTransactionNumber();
    }

    await existingPaymentEntry.save();

    return res.status(200).json({
      hasError: false,
      message: "PaymentEntry updated successfully!",
      data: existingPaymentEntry,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. PaymentEntry already exists.`,
      });
    }

    console.error("Error updating Payment Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
