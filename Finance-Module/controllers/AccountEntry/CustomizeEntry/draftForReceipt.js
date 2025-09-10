import Receipt from "../../../models/Receipt.js";

async function generateReceiptVoucherNumber(schoolId, academicYear) {
  const count = await Receipt.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `RVN/${academicYear}/${nextNumber}`;
}

export async function draftForReceipt(req, res) {
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
      status,
      academicYear,
      totalAmount,
      totalDebitAmount,
      customizeEntry,
    } = req.body;

    const receiptVoucherNumber = await generateReceiptVoucherNumber(
      schoolId,
      academicYear
    );

    const { receiptImage } = req.files || {};

    let receiptImageFullPath = null;
    if (receiptImage?.[0]) {
      const receiptImagePath = receiptImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/ReceiptImage"
        : "/Documents/FinanceModule/ReceiptImage";

      receiptImageFullPath = `${receiptImagePath}/${receiptImage[0].filename}`;
    }

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
      receiptVoucherNumber,
      entryDate,
      receiptDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalAmount,
      subTotalOfDebit,
      totalAmount,
      totalDebitAmount,
      receiptImage: receiptImageFullPath,
      status,
      academicYear,
      customizeEntry,
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

export default draftForReceipt;
