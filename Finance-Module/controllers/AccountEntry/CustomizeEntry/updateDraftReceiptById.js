import Receipt from "../../../models/Receipt.js";

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
      receiptDate,
      narration,
      itemDetails,
      status,
      totalAmount,
      totalDebitAmount,
    } = req.body;

    const existingReceipt = await Receipt.findOne({
      _id: id,
      schoolId,
      financialYear,
    });

    if (!existingReceipt) {
      return res.status(404).json({
        hasError: true,
        message: "Receipt not found.",
      });
    }

    // Handle uploaded files (if provided)
    const { receiptImage } = req.files || {};

    if (receiptImage?.[0]) {
      const receiptImagePath = receiptImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/ReceiptImage"
        : "/Documents/FinanceModule/ReceiptImage";
      existingReceipt.receiptImage = `${receiptImagePath}/${receiptImage[0].filename}`;
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

    const subTotalOfDebit = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.debitAmount) || 0),
      0
    );

    // Update fields
    existingReceipt.entryDate = entryDate;
    existingReceipt.receiptDate = receiptDate;
    existingReceipt.narration = narration;
    existingReceipt.itemDetails = updatedItemDetails;
    existingReceipt.subTotalAmount = subTotalAmount;
    existingReceipt.subTotalOfDebit = subTotalOfDebit;
    existingReceipt.totalAmount = totalAmount;
    existingReceipt.totalDebitAmount = totalDebitAmount;

    existingReceipt.status = status;

    await existingReceipt.save();

    return res.status(200).json({
      hasError: false,
      message: "Receipt updated successfully!",
      data: existingReceipt,
    });
  } catch (error) {
    console.error("Error updating Receipt Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
