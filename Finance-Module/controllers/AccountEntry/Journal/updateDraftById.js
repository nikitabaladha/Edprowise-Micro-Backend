import Journal from "../../../models/Journal.js";

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
      narration,
      itemDetails,
      TDSorTCS,
      TDSTCSRateWithDebitAmount,
      TDSTCSRateWithCreditAmount,
      status,
    } = req.body;

    const existingJournal = await Journal.findOne({
      _id: id,
      schoolId,
      academicYear,
    });

    if (!existingJournal) {
      return res.status(404).json({
        hasError: true,
        message: "Journal not found.",
      });
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
      subTotalOfDebit + Number(TDSTCSRateWithDebitAmount) || 0;

    const totalAmountOfCredit =
      subTotalOfCredit + Number(TDSTCSRateWithCreditAmount) || 0;

    // Update fields
    existingJournal.entryDate = entryDate || existingJournal.entryDate;
    existingJournal.itemDetails = updatedItemDetails;
    existingJournal.subTotalOfDebit = subTotalOfDebit;
    existingJournal.subTotalOfCredit = subTotalOfCredit;
    existingJournal.TDSorTCS = TDSorTCS || existingJournal.TDSorTCS;
    existingJournal.TDSTCSRateWithDebitAmount =
      Number(TDSTCSRateWithDebitAmount) || 0;
    existingJournal.TDSTCSRateWithCreditAmount =
      Number(TDSTCSRateWithCreditAmount) || 0;
    existingJournal.totalAmountOfDebit = totalAmountOfDebit;
    existingJournal.totalAmountOfCredit = totalAmountOfCredit;
    existingJournal.narration = narration || existingJournal.narration;

    existingJournal.status = status || existingJournal.status;

    await existingJournal.save();

    return res.status(200).json({
      hasError: false,
      message: "Journal updated successfully!",
      data: existingJournal,
    });
  } catch (error) {
    console.error("Error updating Journal Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
