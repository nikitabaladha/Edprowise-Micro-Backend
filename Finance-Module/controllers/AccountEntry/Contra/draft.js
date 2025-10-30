import Contra from "../../../models/Contra.js";

export async function draft(req, res) {
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
      contraEntryName,
      dateOfCashDepositedWithdrawlDate,
      narration,
      chequeNumber,
      itemDetails,
      TDSorTCS,
      TDSTCSRateAmount,
      status,
      academicYear,
    } = req.body;

    const { chequeImageForContra } = req.files || {};

    let chequeImageForContraFullPath = "";
    if (chequeImageForContra?.[0]) {
      const basePath = chequeImageForContra[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/chequeImageForContra"
        : "/Documents/FinanceModule/chequeImageForContra";
      chequeImageForContraFullPath = `${basePath}/${chequeImageForContra[0].filename}`;
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

    const totalAmountOfDebit =
      subTotalOfDebit + (parseFloat(TDSTCSRateAmount) || 0);
    const totalAmountOfCredit = subTotalOfCredit;

    const newContra = new Contra({
      schoolId,
      contraEntryName,
      entryDate,
      dateOfCashDepositedWithdrawlDate,
      narration,
      chequeNumber,
      itemDetails: updatedItemDetails,
      subTotalOfCredit: subTotalOfCredit,
      subTotalOfDebit: subTotalOfDebit,
      TDSorTCS,
      TDSTCSRateAmount,
      totalAmountOfDebit,
      totalAmountOfCredit,
      chequeImageForContra: chequeImageForContraFullPath,
      status,
      academicYear,
    });

    await newContra.save();

    return res.status(201).json({
      hasError: false,
      message: "Contra created successfully!",
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

export default draft;
