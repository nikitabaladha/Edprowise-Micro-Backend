import Contra from "../../../models/Contra.js";

export async function copyForContra(req, res) {
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
      dateOfCashDepositedWithdrawlDate,
      narration,
      itemDetails,
      financialYear,
      contraEntryName,
      chequeImageForContra,
    } = req.body;

    const chequeImageForContraFullPath = chequeImageForContra || null;

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      debitAmount: parseFloat(item.debitAmount) || 0,
      creditAmount: parseFloat(item.creditAmount) || 0,
    }));

    const subTotalOfDebit = updatedItemDetails.reduce(
      (sum, item) => sum + item.debitAmount,
      0
    );

    const subTotalOfCredit = updatedItemDetails.reduce(
      (sum, item) => sum + item.creditAmount,
      0
    );

    const totalAmountOfDebit = subTotalOfDebit;
    const totalAmountOfCredit = subTotalOfCredit;

    const newContra = new Contra({
      schoolId,
      entryDate,
      dateOfCashDepositedWithdrawlDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalOfCredit: subTotalOfCredit,
      subTotalOfDebit: subTotalOfDebit,
      totalAmountOfDebit,
      totalAmountOfCredit,
      chequeImageForContra: chequeImageForContraFullPath,
      status: "Draft",
      financialYear,
      contraEntryName: contraEntryName || "",
      customizeEntry: true,
    });

    await newContra.save();

    return res.status(201).json({
      hasError: false,
      message: "Contra drafted successfully!",
      data: newContra,
    });
  } catch (error) {
    console.error("Error creating Contra:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default copyForContra;
