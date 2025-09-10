import Contra from "../../../models/Contra.js";

export async function updateById(req, res) {
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
      entryDate,
      dateOfCashDepositedWithdrawlDate,
      narration,
      itemDetails,
      status,
      contraEntryName,
    } = req.body;

    const existingContra = await Contra.findOne({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!existingContra) {
      return res.status(404).json({
        hasError: true,
        message: "Contra not found.",
      });
    }

    const { chequeImageForContra } = req.files || {};

    if (chequeImageForContra?.[0]) {
      const basePath = chequeImageForContra[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/chequeImageForContra"
        : "/Documents/FinanceModule/chequeImageForContra";
      existingContra.chequeImageForContra = `${basePath}/${chequeImageForContra[0].filename}`;
    }

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

    // Update fields
    existingContra.entryDate = entryDate || existingContra.entryDate;
    existingContra.contraEntryName =
      contraEntryName || existingContra.contraEntryName;
    existingContra.dateOfCashDepositedWithdrawlDate =
      dateOfCashDepositedWithdrawlDate ||
      existingContra.dateOfCashDepositedWithdrawlDate;
    existingContra.narration = narration || existingContra.narration;
    existingContra.itemDetails = updatedItemDetails;
    existingContra.subTotalOfDebit = subTotalOfDebit;
    existingContra.subTotalOfCredit = subTotalOfCredit;
    existingContra.totalAmountOfDebit = totalAmountOfDebit;
    existingContra.totalAmountOfCredit = totalAmountOfCredit;
    existingContra.status = status || existingContra.status;

    await existingContra.save();

    return res.status(200).json({
      hasError: false,
      message: "Contra updated successfully!",
      data: existingContra,
    });
  } catch (error) {
    console.error("Error updating contra Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
