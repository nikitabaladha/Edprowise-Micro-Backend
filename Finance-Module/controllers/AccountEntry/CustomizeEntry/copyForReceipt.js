import Receipt from "../../../models/Receipt.js";

export async function copyForReceipt(req, res) {
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
      itemDetails,
      financialYear,
      totalAmount,
      totalDebitAmount,
      receiptImage,
    } = req.body;

    const receiptImageFullPath = receiptImage || null;

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      debitAmount: parseFloat(item.debitAmount) || 0,
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

    const newReceipt = new Receipt({
      schoolId,
      entryDate,
      receiptDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalAmount,
      subTotalOfDebit,
      totalAmount,
      totalDebitAmount,
      receiptImage: receiptImageFullPath,
      status: "Draft",
      financialYear,
      customizeEntry: true,
    });

    await newReceipt.save();

    return res.status(201).json({
      hasError: false,
      message: "Receipt drafted successfully!",
      data: newReceipt,
    });
  } catch (error) {
    console.error("Error creating Receipt:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default copyForReceipt;
