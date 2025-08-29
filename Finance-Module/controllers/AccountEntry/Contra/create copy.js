import Contra from "../../../models/Contra.js";
import ContraValidator from "../../../validators/ContraValidator.js";

async function generateContraVoucherNumber(schoolId, academicYear) {
  const count = await Contra.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `CVN/${academicYear}/${nextNumber}`;
}

export async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const { error } = ContraValidator.ContraValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
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

    const ContraVoucherNumber = await generateContraVoucherNumber(
      schoolId,
      academicYear
    );

    const { chequeImageForContra } = req.files || {};

    if (["Cash Withdrawn", "Bank Transfer"].includes(contraEntryName)) {
      // if (!chequeImageForContra?.[0]) {
      //   return res.status(400).json({
      //     hasError: true,
      //     message: "Cheque image is required for this Contra entry type.",
      //   });
      // }
    }

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

    if (totalAmountOfDebit !== totalAmountOfCredit) {
      return res.status(400).json({
        hasError: true,
        message: "Total Debit and Credit amounts must be equal.",
      });
    }

    if (["Cash Deposited", "Cash Withdrawn"].includes(contraEntryName)) {
      const missingCashAccount = updatedItemDetails.some(
        (item) => !item.ledgerIdOfCashAccount
      );
      if (missingCashAccount) {
        return res.status(400).json({
          hasError: true,
          message:
            "ledgerIdOfCashAccount is required for Cash Deposited or Cash Withdrawn entries.",
        });
      }

      // if (!TDSorTCS || !["TDS", "TCS"].includes(TDSorTCS)) {
      //   return res.status(400).json({
      //     hasError: true,
      //     message: "TDS or TCS Required and must be valid.",
      //   });
      // }
    }

    const newContra = new Contra({
      schoolId,
      contraVoucherNumber: ContraVoucherNumber,
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

export default create;
