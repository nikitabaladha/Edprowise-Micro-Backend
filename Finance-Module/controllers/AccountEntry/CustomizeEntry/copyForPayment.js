import PaymentEntry from "../../../models/PaymentEntry.js";

export async function copyForPayment(req, res) {
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
      totalAmountAfterGST,
      totalCreditAmount,
      academicYear,
      invoiceImage,
    } = req.body;

    // Use the existing invoiceImage path from the copied entry
    const invoiceImageFullPath = invoiceImage || null;

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
      entryDate,
      invoiceDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalAmountAfterGST,
      subTotalOfCredit,
      totalAmountAfterGST,
      totalCreditAmount,
      customizeEntry: true,
      invoiceImage: invoiceImageFullPath,
      status: "Draft",
      academicYear,
    });

    await newPaymentEntry.save();

    return res.status(201).json({
      hasError: false,
      message: "Payment copied as draft successfully!",
      data: newPaymentEntry,
    });
  } catch (error) {
    console.error("Error copying Payment:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default copyForPayment;
