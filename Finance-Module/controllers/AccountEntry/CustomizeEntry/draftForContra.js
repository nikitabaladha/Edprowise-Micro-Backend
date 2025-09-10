import Contra from "../../../models/Contra.js";

async function generateContraVoucherNumber(schoolId, academicYear) {
  const count = await Contra.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `CVN/${academicYear}/${nextNumber}`;
}

export async function draftForContra(req, res) {
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
      status,
      academicYear,
      contraEntryName,
      customizeEntry,
    } = req.body;

    const ContraVoucherNumber = await generateContraVoucherNumber(
      schoolId,
      academicYear
    );

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

    const totalAmountOfDebit = subTotalOfDebit;
    const totalAmountOfCredit = subTotalOfCredit;

    const newContra = new Contra({
      schoolId,
      contraVoucherNumber: ContraVoucherNumber,
      entryDate,
      dateOfCashDepositedWithdrawlDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalOfCredit: subTotalOfCredit,
      subTotalOfDebit: subTotalOfDebit,
      totalAmountOfDebit,
      totalAmountOfCredit,
      chequeImageForContra: chequeImageForContraFullPath,
      status,
      academicYear,
      contraEntryName: contraEntryName || "",
      customizeEntry,
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

export default draftForContra;
