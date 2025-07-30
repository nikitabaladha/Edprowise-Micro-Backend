import Contra from "../../../models/Contra.js";
import ContraValidator from "../../../validators/ContraValidator.js";

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

    const { error } = ContraValidator.ContraValidatorUpdate.validate(req.body);
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
    if (["Cash Withdrawn", "Bank Transfer"].includes(contraEntryName)) {
      // if (!chequeImageForContra?.[0] && !existingContra.chequeImageForContra) {
      //   return res.status(400).json({
      //     hasError: true,
      //     message: "Cheque image is required for this Contra entry type.",
      //   });
      // }
    }

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
            "LedgerId Of CashAccount is required for Cash Deposited or Cash Withdrawn entries.",
        });
      }

      // if (!TDSorTCS || !["TDS", "TCS"].includes(TDSorTCS)) {
      //   return res.status(400).json({
      //     hasError: true,
      //     message: "TDS or TCS is required and must be valid.",
      //   });
      // }
    }

    // Update fields
    existingContra.entryDate = entryDate || existingContra.entryDate;
    existingContra.contraEntryName =
      contraEntryName || existingContra.contraEntryName;
    existingContra.dateOfCashDepositedWithdrawlDate =
      dateOfCashDepositedWithdrawlDate ||
      existingContra.dateOfCashDepositedWithdrawlDate;
    existingContra.narration = narration || existingContra.narration;
    existingContra.chequeNumber = chequeNumber || existingContra.chequeNumber;
    existingContra.itemDetails = updatedItemDetails;
    existingContra.subTotalOfDebit = subTotalOfDebit;
    existingContra.subTotalOfCredit = subTotalOfCredit;
    existingContra.TDSorTCS = TDSorTCS || existingContra.TDSorTCS;
    existingContra.TDSTCSRateAmount = parseFloat(TDSTCSRateAmount) || 0;
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
    console.error("Error updating Contra Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
