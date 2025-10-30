import Journal from "../../../models/Journal.js";

export async function copyForJournal(req, res) {
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
      documentDate,
      narration,
      itemDetails,
      academicYear,
      documentImage,
    } = req.body;

    const documentImageFullPath = documentImage || null;

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

    const totalAmountOfDebit = subTotalOfDebit || 0;

    const totalAmountOfCredit = subTotalOfCredit || 0;

    const newJournal = new Journal({
      schoolId,
      entryDate,
      documentDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalOfCredit: subTotalOfCredit,
      subTotalOfDebit: subTotalOfDebit,
      totalAmountOfDebit,
      totalAmountOfCredit,
      documentImage: documentImageFullPath,
      academicYear,
      customizeEntry: true,
      status: "Draft",
    });

    await newJournal.save();

    return res.status(201).json({
      hasError: false,
      message: "Journal drafted successfully!",
      data: newJournal,
    });
  } catch (error) {
    console.error("Error creating Journal:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default copyForJournal;
