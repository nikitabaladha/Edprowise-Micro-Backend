import mongoose from "mongoose";
import PaymentEntry from "../../../models/PaymentEntry.js";
import PaymentEntryValidator from "../../../validators/CustomizeEntryForPaymentValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";

async function generatePaymentVoucherNumber(schoolId, academicYear) {
  const count = await PaymentEntry.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `PVN/${academicYear}/${nextNumber}`;
}
// my current api is perfectly fine just one thing you need to add
// see here also i want like if same ledgerId then isted of storing new you can aggregate that ledgerId and
// accordingly store that credit and debit amounts well as closing balance
// see here i also have amountafterGST as well as creditAmount to store

async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate
) {
  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  });

  let openingBalance = 0;
  let balanceType = "Debit";

  if (ledger) {
    balanceType = ledger.balanceType;
    openingBalance = ledger.openingBalance || 0;
  }

  let record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  });

  if (!record) {
    record = new OpeningClosingBalance({
      schoolId,
      academicYear,
      ledgerId,
      balanceDetails: [],
      balanceType,
    });
  }

  // Find the latest balance detail before the entry date
  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) < new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  if (previousBalanceDetails.length > 0) {
    const lastBalanceDetail = previousBalanceDetails[0];
    openingBalance = lastBalanceDetail.closingBalance;
  }

  return { record, openingBalance, balanceType };
}

async function updateOpeningClosingBalance(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  paymentEntryId,
  debitAmount = 0,
  creditAmount = 0
) {
  debitAmount = Number(debitAmount);
  creditAmount = Number(creditAmount);

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate
    );

  // --- FIX: Determine effective opening balance ---
  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) <= new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  let effectiveOpeningBalance = openingBalance;
  if (previousBalanceDetails.length > 0) {
    effectiveOpeningBalance = previousBalanceDetails[0].closingBalance;
  }

  // --- Calculate closing balance ---
  let closingBalance;
  if (balanceType === "Debit") {
    closingBalance = effectiveOpeningBalance + debitAmount - creditAmount;
  } else {
    closingBalance = effectiveOpeningBalance + debitAmount - creditAmount;
  }

  // --- Check if exact same entry already exists ---
  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) =>
      new Date(detail.entryDate).getTime() === new Date(entryDate).getTime() &&
      detail.entryId?.toString() === paymentEntryId.toString()
  );

  if (existingEntryIndex !== -1) {
    record.balanceDetails[existingEntryIndex] = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: paymentEntryId, // Store Payment Entry _id as entryId
    };
  } else {
    const newBalanceDetail = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: paymentEntryId, // Store Payment Entry _id as entryId
    };

    record.balanceDetails.push(newBalanceDetail);
  }

  // Sort by date (and then by _id to ensure chaining order within same day)
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  await record.save();
  return record;
}

async function recalculateLedgerBalances(schoolId, academicYear, ledgerId) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  });

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  });

  const balanceType = ledger?.balanceType || "Debit";

  // Sort all entries by date, then by _id for consistent same-day order
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  // Find the initial opening balance (from ledger or first entry)
  let currentBalance = record.balanceDetails[0].openingBalance;

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = detail.openingBalance;
    } else {
      // Update opening balance to previous closing balance
      detail.openingBalance = record.balanceDetails[i - 1].closingBalance;
      currentBalance = detail.openingBalance;
    }

    // Calculate new closing balance
    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save();
}

async function recalculateAllBalancesAfterDate(
  schoolId,
  academicYear,
  ledgerId,
  date
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  });

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  // Find the index of the first entry after the specified date
  const startIndex = record.balanceDetails.findIndex(
    (detail) => new Date(detail.entryDate) > new Date(date)
  );

  if (startIndex === -1) {
    return; // No entries after this date
  }

  // Get the balance just before the start index
  const previousBalance =
    startIndex > 0
      ? record.balanceDetails[startIndex - 1].closingBalance
      : record.balanceDetails[0].openingBalance;

  let currentBalance = previousBalance;

  // Recalculate all balances from the start index onward
  for (let i = startIndex; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    detail.openingBalance = currentBalance;

    const ledger = await Ledger.findOne({
      schoolId,
      academicYear,
      _id: ledgerId,
    });

    const balanceType = ledger?.balanceType || "Debit";

    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save();
}

async function create(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const { error } = PaymentEntryValidator.PaymentEntryValidator.validate(
      req.body
    );
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

    const {
      entryDate,
      invoiceDate,
      narration,
      itemDetails,
      status,
      totalAmountAfterGST,
      totalCreditAmount,
      customizeEntry,
      academicYear,
    } = req.body;

    const paymentVoucherNumber = await generatePaymentVoucherNumber(
      schoolId,
      academicYear
    );

    const { invoiceImage } = req.files || {};

    const invoiceImageFullPath = invoiceImage?.[0]
      ? `${
          invoiceImage[0].mimetype.startsWith("image/")
            ? "/Images/FinanceModule/InvoiceImage"
            : "/Documents/FinanceModule/InvoiceImage"
        }/${invoiceImage[0].filename}`
      : null;

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amountAfterGST: parseFloat(item.amountAfterGST) || 0,
      creditAmount: parseFloat(item.creditAmount) || 0,
    }));

    const subTotalAmountAfterGST = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amountAfterGST) || 0),
      0
    );

    const subTotalOfCredit = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.creditAmount) || 0),
      0
    );

    const newPaymentEntry = new PaymentEntry({
      schoolId,
      paymentVoucherNumber,
      entryDate,
      invoiceDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalAmountAfterGST,
      subTotalOfCredit,
      totalAmountAfterGST,
      totalCreditAmount,
      customizeEntry,
      invoiceImage: invoiceImageFullPath,
      status,
      academicYear,
    });

    await newPaymentEntry.save({ session });

    // Store all ledger IDs that need to be updated
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers (Debit)
    for (const item of updatedItemDetails) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        item.ledgerId,
        entryDate,
        newPaymentEntry._id, // Pass the Payment Entry
        item.amountAfterGST,
        item.creditAmount
      );
      ledgerIdsToUpdate.add(item.ledgerId.toString());
    }

    // --- Recalculate all ledgers that were updated ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(schoolId, academicYear, ledgerId);

      // Also recalculate all entries after this date to handle backdated entries
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      hasError: false,
      message: "Payment Entry created successfully!",
      data: newPaymentEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Payment Entry already exists.`,
      });
    }

    console.error("Error creating Payment Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
