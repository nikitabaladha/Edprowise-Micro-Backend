import moment from "moment";
import PaymentEntry from "../../../models/PaymentEntry.js";

async function generatePaymentVoucherNumber(schoolId, academicYear) {
  const count = await PaymentEntry.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `PVN/${academicYear}/${nextNumber}`;
}

async function generateTransactionNumber() {
  const now = moment();
  const dateTimeStr = now.format("DDMMYYYYHHmmss");
  const baseTransactionNumber = `TRA-${dateTimeStr}`;
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
      status,
      TDSTCSRateWithAmountBeforeGST,
      ledgerIdWithPaymentMode,
      totalAmountAfterGST,
      academicYear,
    } = req.body;

    if (!academicYear || academicYear.trim() === "") {
      return res.status(400).json({
        hasError: true,
        message: "Academic year is required.",
      });
    }

    const paymentVoucherNumber = await generatePaymentVoucherNumber(
      schoolId,
      academicYear
    );

    const { invoiceImage, chequeImage } = req.files || {};

    const invoiceImagePath = invoiceImage?.[0]?.mimetype?.startsWith("image/")
      ? "/Images/FinanceModule/InvoiceImage"
      : "/Documents/FinanceModule/InvoiceImage";

    const invoiceImageFullPath = invoiceImage?.[0]
      ? `${invoiceImagePath}/${invoiceImage[0].filename}`
      : null;

    const chequeImagePath = chequeImage?.[0]?.mimetype?.startsWith("image/")
      ? "/Images/FinanceModule/ChequeImage"
      : "/Documents/FinanceModule/ChequeImage";

    const chequeImageFullPath = chequeImage?.[0]
      ? `${chequeImagePath}/${chequeImage[0].filename}`
      : null;

    const updatedItemDetails = itemDetails.map((item) => {
      const amountBeforeGST = parseFloat(item.amountBeforeGST) || 0;
      const GSTAmount = parseFloat(item.GSTAmount) || 0;
      return {
        ...item,
        amountBeforeGST,
        GSTAmount,
        amountAfterGST: amountBeforeGST + GSTAmount,
      };
    });

    const totalAmountBeforeGST = updatedItemDetails.reduce(
      (sum, item) => sum + item.amountBeforeGST,
      0
    );

    const totalGSTAmount = updatedItemDetails.reduce(
      (sum, item) => sum + item.GSTAmount,
      0
    );

    const subTotalAmountAfterGST = updatedItemDetails.reduce(
      (sum, item) => sum + item.amountAfterGST,
      0
    );

    // const totalAmountAfterGST =
    //   subTotalAmountAfterGST - (parseFloat(TDSTCSRateWithAmountBeforeGST) || 0);

    const transactionNumber =
      paymentMode === "Online" ? await generateTransactionNumber() : null;

    const newPaymentEntry = new PaymentEntry({
      schoolId,
      academicYear,
      paymentVoucherNumber,
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
      transactionNumber,
      itemDetails: updatedItemDetails,
      subTotalAmountAfterGST,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      TDSTCSRateWithAmountBeforeGST:
        parseFloat(TDSTCSRateWithAmountBeforeGST) || 0,
      totalAmountBeforeGST,
      totalGSTAmount,
      totalAmountAfterGST,
      invoiceImage: invoiceImageFullPath,
      chequeImage: chequeImageFullPath,
      ledgerIdWithPaymentMode,
      status,
    });

    await newPaymentEntry.save();

    return res.status(201).json({
      hasError: false,
      message: "Payment Entry drafted successfully!",
      data: newPaymentEntry,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Payment Entry already exists.`,
      });
    }

    console.error("Error creating Payment Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default draft;
