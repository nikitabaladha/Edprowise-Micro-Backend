import PaymentEntry from "../../../models/PaymentEntry.js";

async function generatePaymentVoucherNumber(schoolId, academicYear) {
  const count = await PaymentEntry.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `PVN/${academicYear}/${nextNumber}`;
}

export async function draftForPayment(req, res) {
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
      invoiceDate,
      narration,
      itemDetails,
      status,
      totalAmountAfterGST,
      totalCreditAmount,
      customizeEntry,
      academicYear,
    } = req.body;

    const PaymentVoucherNumber = await generatePaymentVoucherNumber(
      schoolId,
      academicYear
    );

    const { invoiceImage } = req.files || {};

    const invoiceImageFullPath = invoiceImage?.[0]
      ? `${
          invoiceImage[0].mimetype.startsWith("image/")
            ? "/Images/FinanceModule/InvoiceImage"
            : "/Documents/FinanceModule/InvoiceImage"
        }/${invoiceImage[0].filename}`
      : null;

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amountAfterGST: parseFloat(item.amountAfterGST) || 0,
      creditAmount: parseFloat(item.creditAmount) || 0,
    }));

    const subTotalAmountAfterGST = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amountAfterGST) || 0),
      0
    );

    const subTotalOfCredit = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.creditAmount) || 0),
      0
    );

    const newPaymentEntry = new PaymentEntry({
      schoolId,
      paymentVoucherNumber: PaymentVoucherNumber,
      entryDate,
      invoiceDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalAmountAfterGST,
      subTotalOfCredit,
      totalAmountAfterGST,
      totalCreditAmount,
      customizeEntry,
      invoiceImage: invoiceImageFullPath,
      status,
      academicYear,
    });

    await newPaymentEntry.save();

    return res.status(201).json({
      hasError: false,
      message: "Payment drafted successfully!",
      data: newPaymentEntry,
    });
  } catch (error) {
    console.error("Error creating Payment:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default draftForPayment;
