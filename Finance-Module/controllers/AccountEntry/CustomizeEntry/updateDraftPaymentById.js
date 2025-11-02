import PaymentEntry from "../../../models/PaymentEntry.js";

export async function updateById(req, res) {
  try {
    const schoolId = req.user?.schoolId;
    const { id, financialYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
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
    } = req.body;

    const existingPaymentEntry = await PaymentEntry.findOne({
      _id: id,
      schoolId,
      financialYear,
    });

    if (!existingPaymentEntry) {
      return res.status(404).json({
        hasError: true,
        message: "Payment not found.",
      });
    }

    // Handle uploaded files (if provided)
    const { invoiceImage } = req.files || {};

    if (invoiceImage?.[0]) {
      const invoiceImagePath = invoiceImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/InvoiceImage"
        : "/Documents/FinanceModule/InvoiceImage";
      existingPaymentEntry.invoiceImage = `${invoiceImagePath}/${invoiceImage[0].filename}`;
    }

    // Recalculate item details amounts
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

    // Update fields
    existingPaymentEntry.entryDate = entryDate;
    existingPaymentEntry.invoiceDate = invoiceDate;
    existingPaymentEntry.narration = narration;
    existingPaymentEntry.itemDetails = updatedItemDetails;
    existingPaymentEntry.subTotalAmountAfterGST = subTotalAmountAfterGST;
    existingPaymentEntry.subTotalOfCredit = subTotalOfCredit;
    existingPaymentEntry.totalAmountAfterGST = totalAmountAfterGST;
    existingPaymentEntry.totalCreditAmount = totalCreditAmount;

    existingPaymentEntry.status = status;

    await existingPaymentEntry.save();

    return res.status(200).json({
      hasError: false,
      message: "Payment updated successfully!",
      data: existingPaymentEntry,
    });
  } catch (error) {
    console.error("Error updating Payment Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
