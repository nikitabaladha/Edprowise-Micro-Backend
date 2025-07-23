import Journal from "../../../models/Journal.js";
import JournalValidator from "../../../validators/JournalValidator.js";

async function generateJournalVoucherNumber(schoolId, academicYear) {
  const count = await Journal.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `JVN/${academicYear}/${nextNumber}`;
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

    const { error } = JournalValidator.JournalValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
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
      academicYear,
    } = req.body;

    const JournalVoucherNumber = await generateJournalVoucherNumber(
      schoolId,
      academicYear
    );

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
      subTotalOfDebit + (parseFloat(TDSTCSRateWithDebitAmount) || 0);

    const totalAmountOfCredit =
      subTotalOfCredit + (parseFloat(TDSTCSRateWithCreditAmount) || 0);

    if (totalAmountOfDebit !== totalAmountOfCredit) {
      return res.status(400).json({
        hasError: true,
        message: "Total Debit and Credit amounts must be equal.",
      });
    }

    const newJournal = new Journal({
      schoolId,
      journalVoucherNumber: JournalVoucherNumber,
      entryDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalOfCredit: subTotalOfCredit,
      subTotalOfDebit: subTotalOfDebit,
      TDSorTCS,
      TDSTCSRateWithDebitAmount,
      TDSTCSRateWithCreditAmount,
      totalAmountOfDebit,
      totalAmountOfCredit,
      status,
      academicYear,
    });

    await newJournal.save();

    return res.status(201).json({
      hasError: false,
      message: "Journal created successfully!",
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

export default create;
