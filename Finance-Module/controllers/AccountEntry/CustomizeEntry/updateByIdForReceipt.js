import mongoose from "mongoose";
import Receipt from "../../../models/Receipt.js";
import ReceiptValidator from "../../../validators/CustomizeEntryForReceiptValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

import { hasBankOrCashLedger } from "../../CommonFunction/CommonFunction.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function generateReceiptVoucherNumber(schoolId, academicYear) {
  // Find the highest existing voucher number
  const lastEntry = await Receipt.findOne(
    {
      schoolId,
      academicYear,
      status: "Posted",
      receiptVoucherNumber: { $exists: true, $ne: null },
    },
    { receiptVoucherNumber: 1 },
    { sort: { receiptVoucherNumber: -1 } }
  );

  let nextNumber = 1;

  if (lastEntry && lastEntry.receiptVoucherNumber) {
    const matches = lastEntry.receiptVoucherNumber.match(/\/(\d+)$/);
    if (matches && matches[1]) {
      nextNumber = parseInt(matches[1]) + 1;
    }
  }

  return `RVN/${academicYear}/${nextNumber}`;
}

async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  session
) {
  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session);

  let openingBalance = 0;
  let balanceType = "Debit";

  if (ledger) {
    balanceType = ledger.balanceType;
    openingBalance = toTwoDecimals(ledger.openingBalance || 0);
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
    .sort((a, b) => {
      const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
      if (dateDiff !== 0) return dateDiff;
      return (a.entrySequence || 0) - (b.entrySequence || 0);
    });

  if (previousBalanceDetails.length > 0) {
    const lastBalanceDetail =
      previousBalanceDetails[previousBalanceDetails.length - 1];
    openingBalance = toTwoDecimals(lastBalanceDetail.closingBalance);
  }

  return { record, openingBalance, balanceType };
}

async function updateOpeningClosingBalance(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  receiptEntryId,
  debitAmount = 0,
  creditAmount = 0,
  session
) {
  debitAmount = toTwoDecimals(Number(debitAmount));
  creditAmount = toTwoDecimals(Number(creditAmount));

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate,
      session
    );

  // Find existing entry FIRST to preserve its sequence
  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) => detail.entryId?.toString() === receiptEntryId.toString()
  );

  let entrySequence;

  if (existingEntryIndex !== -1) {
    const existing = record.balanceDetails[existingEntryIndex];
    entrySequence = existing.entrySequence; // Keep the original sequence

    // Calculate opening balance based on position in the sequence
    let effectiveOpeningBalance = openingBalance;

    if (existingEntryIndex > 0) {
      // Use previous entry's closing balance
      effectiveOpeningBalance = toTwoDecimals(
        record.balanceDetails[existingEntryIndex - 1].closingBalance
      );
    } else {
      // First entry - find last balance before this date
      const entriesBeforeDate = record.balanceDetails.filter(
        (detail) => new Date(detail.entryDate) < new Date(entryDate)
      );

      if (entriesBeforeDate.length > 0) {
        entriesBeforeDate.sort((a, b) => {
          const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
          if (dateDiff !== 0) return dateDiff;
          return (a.entrySequence || 0) - (b.entrySequence || 0);
        });
        effectiveOpeningBalance = toTwoDecimals(
          entriesBeforeDate[entriesBeforeDate.length - 1].closingBalance
        );
      } else {
        effectiveOpeningBalance = openingBalance;
      }
    }

    const closingBalance = toTwoDecimals(
      effectiveOpeningBalance + debitAmount - creditAmount
    );

    // Update the existing entry IN PLACE
    existing.debit = debitAmount;
    existing.credit = creditAmount;
    existing.entryDate = entryDate;
    existing.openingBalance = effectiveOpeningBalance;
    existing.closingBalance = closingBalance;
  } else {
    // New entry - find correct sequence (same as before)
    const sameDayEntries = record.balanceDetails.filter(
      (d) =>
        new Date(d.entryDate).toDateString() ===
        new Date(entryDate).toDateString()
    );

    entrySequence =
      sameDayEntries.length > 0
        ? Math.max(...sameDayEntries.map((d) => d.entrySequence || 0)) + 1
        : 1;

    // Calculate opening balance for new entry
    let effectiveOpeningBalance = openingBalance;
    const entriesBeforeDate = record.balanceDetails.filter(
      (detail) => new Date(detail.entryDate) < new Date(entryDate)
    );

    if (entriesBeforeDate.length > 0) {
      entriesBeforeDate.sort((a, b) => {
        const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
        if (dateDiff !== 0) return dateDiff;
        return (a.entrySequence || 0) - (b.entrySequence || 0);
      });
      effectiveOpeningBalance = toTwoDecimals(
        entriesBeforeDate[entriesBeforeDate.length - 1].closingBalance
      );
    }

    const closingBalance = toTwoDecimals(
      effectiveOpeningBalance + debitAmount - creditAmount
    );

    const newBalanceDetail = {
      entryDate,
      entrySequence,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: receiptEntryId,
    };

    record.balanceDetails.push(newBalanceDetail);
  }

  // Always sort after modifications
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  await record.save({ session });
  return record;
}

async function recalculateLedgerBalances(
  schoolId,
  academicYear,
  ledgerId,
  session
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session);

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session);

  const balanceType = ledger?.balanceType || "Debit";

  // Sort by date and sequence to ensure correct order
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Recalculate sequences to ensure continuity
  let currentDate = null;
  let currentSequence = 0;

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    const detailDate = new Date(detail.entryDate).toDateString();

    if (currentDate !== detailDate) {
      currentDate = detailDate;
      currentSequence = 1;
    } else {
      currentSequence++;
    }
    detail.entrySequence = currentSequence;
  }

  // Re-sort after sequence correction
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Recalculate balances while preserving the corrected sequence
  let currentBalance = toTwoDecimals(record.balanceDetails[0].openingBalance);

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = toTwoDecimals(detail.openingBalance);
    } else {
      const previousDetail = record.balanceDetails[i - 1];
      detail.openingBalance = toTwoDecimals(previousDetail.closingBalance);
      currentBalance = toTwoDecimals(detail.openingBalance);
    }

    detail.closingBalance = toTwoDecimals(
      currentBalance + detail.debit - detail.credit
    );
    currentBalance = toTwoDecimals(detail.closingBalance);
  }

  await record.save({ session });
}

async function recalculateAllBalancesAfterDate(
  schoolId,
  academicYear,
  ledgerId,
  date,
  session
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session);

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  // Sort by date and entrySequence
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  const startIndex = record.balanceDetails.findIndex(
    (detail) => new Date(detail.entryDate) > new Date(date)
  );

  if (startIndex === -1) {
    return;
  }

  const previousBalance = toTwoDecimals(
    startIndex > 0
      ? record.balanceDetails[startIndex - 1].closingBalance
      : record.balanceDetails[0].openingBalance
  );

  let currentBalance = previousBalance;

  for (let i = startIndex; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    detail.openingBalance = toTwoDecimals(currentBalance);
    detail.closingBalance = toTwoDecimals(
      currentBalance + detail.debit - detail.credit
    );
    currentBalance = detail.closingBalance;
  }

  await record.save({ session });
}

async function removeReceiptEntryFromLedger(
  schoolId,
  academicYear,
  receiptEntryId,
  ledgerId,
  session
) {
  // Find the record
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session);

  if (!record) return;

  // Remove the entry from balanceDetails
  const originalLength = record.balanceDetails.length;

  record.balanceDetails = record.balanceDetails.filter(
    (detail) => detail.entryId?.toString() !== receiptEntryId.toString()
  );

  if (record.balanceDetails.length === originalLength) return; // nothing removed

  // Sort the remaining entries by date and sequence
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Recalculate sequences for same-day entries
  let currentDate = null;
  let currentSequence = 0;

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    const detailDate = new Date(detail.entryDate).toDateString();

    if (currentDate !== detailDate) {
      currentDate = detailDate;
      currentSequence = 1;
    } else {
      currentSequence++;
    }

    detail.entrySequence = currentSequence;
  }

  // Re-sort after sequence correction
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Recalculate opening and closing balances
  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    if (i === 0) {
      // First entry uses ledger opening balance
      const ledger = await Ledger.findById(ledgerId).session(session);
      detail.openingBalance = toTwoDecimals(ledger?.openingBalance || 0);
    } else {
      detail.openingBalance = toTwoDecimals(
        record.balanceDetails[i - 1].closingBalance
      );
    }
    detail.closingBalance = toTwoDecimals(
      detail.openingBalance + detail.debit - detail.credit
    );
  }

  await record.save({ session });
}

function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const debitAmount = toTwoDecimals(item.debitAmount) || 0;
    const amount = toTwoDecimals(item.amount) || 0;

    if (ledgerMap.has(ledgerId)) {
      const existing = ledgerMap.get(ledgerId);
      ledgerMap.set(ledgerId, {
        debitAmount: existing.debitAmount + debitAmount,
        amount: existing.amount + amount,
      });
    } else {
      ledgerMap.set(ledgerId, {
        debitAmount: debitAmount,
        amount: amount,
      });
    }
  });

  return ledgerMap;
}

async function propagateBalanceChangeToNextYear(
  schoolId,
  currentAcademicYear,
  ledgerId,
  session
) {
  try {
    // Find the current ledger to get its details
    const currentLedger = await Ledger.findOne({
      schoolId,
      academicYear: currentAcademicYear,
      _id: ledgerId,
    }).session(session);

    if (!currentLedger) {
      console.log(`Ledger ${ledgerId} not found in ${currentAcademicYear}`);
      return;
    }

    // Calculate next academic year
    const [yearPart1, yearPart2] = currentAcademicYear.split("-");
    const nextAcademicYear = `${parseInt(yearPart1) + 1}-${
      parseInt(yearPart2) + 1
    }`;

    // Find the next year's ledger that has the CURRENT ledger as parent
    const nextYearLedger = await Ledger.findOne({
      schoolId,
      academicYear: nextAcademicYear,
      parentLedgerId: currentLedger._id,
    }).session(session);

    if (!nextYearLedger) {
      console.log(`No next year ledger found for ${currentLedger.ledgerName}`);
      return; // No next year ledger found
    }

    // Get the current year's balance record for this ledger
    const currentYearBalance = await OpeningClosingBalance.findOne({
      schoolId,
      academicYear: currentAcademicYear,
      ledgerId: ledgerId,
    }).session(session);

    let newOpeningBalance = 0;

    // FIXED: Handle both cases properly
    if (currentYearBalance && currentYearBalance.balanceDetails.length > 0) {
      // Case 1: There are balance details - use last closing balance
      const lastEntry =
        currentYearBalance.balanceDetails[
          currentYearBalance.balanceDetails.length - 1
        ];
      newOpeningBalance = lastEntry.closingBalance;
    } else {
      // Case 2: No balance details exist - use the current ledger's opening balance
      // This happens when all entries are removed or ledger has no transactions
      newOpeningBalance = currentLedger.openingBalance || 0;
    }

    // Update the next year's ledger opening balance
    await Ledger.findOneAndUpdate(
      {
        schoolId,
        academicYear: nextAcademicYear,
        _id: nextYearLedger._id,
      },
      {
        $set: {
          openingBalance: newOpeningBalance,
          balanceType: newOpeningBalance < 0 ? "Credit" : "Debit",
        },
      },
      { session }
    );

    // Update the OpeningClosingBalance for next year
    let nextYearOpeningBalance = await OpeningClosingBalance.findOne({
      schoolId,
      academicYear: nextAcademicYear,
      ledgerId: nextYearLedger._id,
    }).session(session);

    if (!nextYearOpeningBalance) {
      // Create new OpeningClosingBalance record if it doesn't exist
      nextYearOpeningBalance = new OpeningClosingBalance({
        schoolId,
        academicYear: nextAcademicYear,
        ledgerId: nextYearLedger._id,
        balanceDetails: [],
        balanceType: newOpeningBalance < 0 ? "Credit" : "Debit",
      });

      // Create initial balance detail with the new opening balance
      nextYearOpeningBalance.balanceDetails.push({
        entryDate: new Date(),
        openingBalance: newOpeningBalance,
        debit: 0,
        credit: 0,
        closingBalance: newOpeningBalance,
      });
    } else {
      // FIXED: Find and update the opening balance entry
      // Look for an entry without entryId (opening balance entry)
      let openingBalanceEntry = nextYearOpeningBalance.balanceDetails.find(
        (detail) => !detail.entryId
      );

      if (
        !openingBalanceEntry &&
        nextYearOpeningBalance.balanceDetails.length > 0
      ) {
        // If no dedicated opening balance entry, use the first entry
        openingBalanceEntry = nextYearOpeningBalance.balanceDetails[0];
      }

      if (openingBalanceEntry) {
        const oldOpeningBalance = openingBalanceEntry.openingBalance;

        // Only update if the opening balance has changed
        if (oldOpeningBalance !== newOpeningBalance) {
          openingBalanceEntry.openingBalance = newOpeningBalance;
          openingBalanceEntry.closingBalance = toTwoDecimals(
            newOpeningBalance +
              openingBalanceEntry.debit -
              openingBalanceEntry.credit
          );

          // Recalculate all subsequent entries
          let currentBalance = openingBalanceEntry.closingBalance;
          const startIndex =
            nextYearOpeningBalance.balanceDetails.indexOf(openingBalanceEntry) +
            1;

          for (
            let i = startIndex;
            i < nextYearOpeningBalance.balanceDetails.length;
            i++
          ) {
            const detail = nextYearOpeningBalance.balanceDetails[i];
            detail.openingBalance = currentBalance;
            detail.closingBalance = toTwoDecimals(
              currentBalance + detail.debit - detail.credit
            );
            currentBalance = detail.closingBalance;
          }
        }
      } else {
        // If no entries exist at all, create an opening balance entry
        nextYearOpeningBalance.balanceDetails.push({
          entryDate: new Date(),
          openingBalance: newOpeningBalance,
          debit: 0,
          credit: 0,
          closingBalance: newOpeningBalance,
        });
      }
    }

    await nextYearOpeningBalance.save({ session });

    // Recursively propagate to the next year if it exists
    await propagateBalanceChangeToNextYear(
      schoolId,
      nextAcademicYear,
      nextYearLedger._id,
      session
    );
  } catch (propagationError) {
    console.error(
      `Error in propagateBalanceChangeToNextYear for ledger ${ledgerId}:`,
      propagationError
    );
    throw propagationError;
  }
}

async function updateById(req, res) {
  // First, do all validations BEFORE starting the transaction
  const schoolId = req.user?.schoolId;
  const { id, academicYear } = req.params;

  if (!schoolId) {
    return res.status(401).json({
      hasError: true,
      message: "Access denied: Unauthorized request.",
    });
  }

  const { error } = ReceiptValidator.ReceiptValidatorUpdate.validate(req.body);
  if (error) {
    const errorMessages = error.details.map((err) => err.message).join(", ");
    return res.status(400).json({
      hasError: true,
      message: errorMessages,
    });
  }

  const {
    entryDate,
    receiptDate,
    narration,
    itemDetails,
    status,
    totalAmount,
    totalDebitAmount,
  } = req.body;

  // Validate Bank/Cash ledger requirement BEFORE transaction
  const hasValidLedger = await hasBankOrCashLedger(
    schoolId,
    academicYear,
    itemDetails
  );

  if (!hasValidLedger) {
    return res.status(400).json({
      hasError: true,
      message:
        "At least one ledger must have Group Ledger Name as 'Bank' or 'Cash'",
    });
  }

  // NOW start the transaction after all validations pass
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingReceipt = await Receipt.findOne({
      _id: id,
      schoolId,
      academicYear,
    }).session(session);

    if (!existingReceipt) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "Receipt not found.",
      });
    }

    const oldItemLedgerIds = existingReceipt.itemDetails.map((item) =>
      item.ledgerId?.toString()
    );

    // Store old values for comparison
    const oldEntryDate = existingReceipt.entryDate;
    const oldItemDetails = existingReceipt.itemDetails;
    const oldStatus = existingReceipt.status;

    let receiptVoucherNumber = existingReceipt.receiptVoucherNumber;
    if (
      status === "Posted" &&
      !receiptVoucherNumber &&
      oldStatus !== "Posted"
    ) {
      receiptVoucherNumber = await generateReceiptVoucherNumber(
        schoolId,
        academicYear
      );
    }

    // Handle uploaded files
    const { receiptImage } = req.files || {};

    if (receiptImage?.[0]) {
      const receiptImagePath = receiptImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/ReceiptImage"
        : "/Documents/FinanceModule/ReceiptImage";
      existingReceipt.receiptImage = `${receiptImagePath}/${receiptImage[0].filename}`;
    }

    // Recalculate item details amounts
    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amount: parseFloat(item.amount) || 0,
      debitAmount: parseFloat(item.debitAmount) || 0,
    }));

    const subTotalAmount = toTwoDecimals(
      updatedItemDetails.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0
      )
    );

    const subTotalOfDebit = toTwoDecimals(
      updatedItemDetails.reduce(
        (sum, item) => sum + (parseFloat(item.debitAmount) || 0),
        0
      )
    );

    // Update fields
    existingReceipt.entryDate = entryDate;
    existingReceipt.receiptDate = receiptDate;
    existingReceipt.narration = narration;
    existingReceipt.itemDetails = updatedItemDetails;
    existingReceipt.subTotalAmount = subTotalAmount;
    existingReceipt.subTotalOfDebit = subTotalOfDebit;
    existingReceipt.totalAmount = totalAmount;
    existingReceipt.totalDebitAmount = totalDebitAmount;
    existingReceipt.receiptVoucherNumber = receiptVoucherNumber;
    existingReceipt.status = status;

    await existingReceipt.save({ session });

    // Get new ledger IDs
    const newItemLedgerIds = updatedItemDetails.map((item) =>
      item.ledgerId?.toString()
    );

    // --- Step A: Reset old balances to zero first (like Receipt does) ---
    const balanceRecords = await OpeningClosingBalance.find({
      schoolId,
      academicYear,
      "balanceDetails.entryId": id,
    }).session(session);

    for (const record of balanceRecords) {
      for (const detail of record.balanceDetails) {
        if (detail.entryId?.toString() === id.toString()) {
          detail.debit = 0;
          detail.credit = 0;
        }
      }
      await record.save({ session });
    }

    // Remove entries from old ledgers that are no longer used
    for (const oldLedgerId of oldItemLedgerIds) {
      if (oldLedgerId && !newItemLedgerIds.includes(oldLedgerId)) {
        await removeReceiptEntryFromLedger(
          schoolId,
          academicYear,
          id,
          oldLedgerId,
          session
        );
      }
    }

    // --- Step C: Apply new balances ---
    const ledgerIdsToUpdate = new Set();

    // Aggregate amounts by ledgerId and update balances
    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);

    for (const [ledgerId, amounts] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        existingReceipt._id,
        amounts.debitAmount,
        amounts.amount,
        session
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // --- Step D: Recalculate all affected ledgers ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        ledgerId,
        session
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        session
      );
    }

    // Get all unique ledger IDs from updatedItemDetails
    const uniqueLedgerIds = [
      ...new Set(updatedItemDetails.map((item) => item.ledgerId)),
    ];

    // Find ledgers with their Head of Account information
    const ledgers = await Ledger.find({
      _id: { $in: uniqueLedgerIds },
    })
      .populate("headOfAccountId")
      .session(session);

    // Initialize sums
    let incomeBalance = 0;
    let expensesBalance = 0;

    // Calculate sums based on Head of Account
    for (const item of updatedItemDetails) {
      const ledger = ledgers.find(
        (l) => l._id.toString() === item.ledgerId.toString()
      );

      if (ledger && ledger.headOfAccountId) {
        const headOfAccountName = ledger.headOfAccountId.headOfAccountName;
        const amount = parseFloat(item.amount) || 0;
        const debitAmount = parseFloat(item.debitAmount) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          incomeBalance += debitAmount - amount;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          expensesBalance += debitAmount - amount;
        }
      }
    }

    // Calculate total balance
    const totalBalance = toTwoDecimals(incomeBalance - expensesBalance);

    // Round to two decimals
    incomeBalance = toTwoDecimals(incomeBalance);
    expensesBalance = toTwoDecimals(expensesBalance);

    // Find or create TotalNetdeficitNetSurplus record
    let totalNetRecord = await TotalNetdeficitNetSurplus.findOne({
      schoolId,
      academicYear,
    }).session(session);

    if (!totalNetRecord) {
      totalNetRecord = new TotalNetdeficitNetSurplus({
        schoolId,
        academicYear,
        balanceDetails: [],
      });
    }

    // FIXED: Check if entry exists by entryId ONLY (not by date)
    const existingEntryIndex = totalNetRecord.balanceDetails.findIndex(
      (detail) => detail.entryId?.toString() === id.toString()
    );

    if (existingEntryIndex !== -1) {
      // Update existing entry - REPLACE values
      totalNetRecord.balanceDetails[existingEntryIndex].incomeBalance =
        incomeBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].expensesBalance =
        expensesBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].totalBalance =
        totalBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].entryDate = entryDate;
    } else {
      // Create new entry if it doesn't exist
      totalNetRecord.balanceDetails.push({
        entryDate,
        entryId: existingReceipt._id,
        incomeBalance,
        expensesBalance,
        totalBalance,
      });
    }

    // Sort balanceDetails by date
    totalNetRecord.balanceDetails.sort(
      (a, b) => new Date(a.entryDate) - new Date(b.entryDate)
    );

    await totalNetRecord.save({ session });

    // =====Start Of Net Surplus/(Deficit)...Capital Fund=====

    const netSurplusDeficitLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Net Surplus/(Deficit)",
    }).session(session);

    const capitalFundLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Capital Fund",
    }).session(session);

    if (!netSurplusDeficitLedger || !capitalFundLedger) {
      throw new Error(
        "Required ledgers (Net Surplus/(Deficit) or Capital Fund) not found"
      );
    }

    // Initialize amounts for both ledgers
    let netSurplusDebitAmount = 0;
    let netSurplusCreditAmount = 0;
    let capitalFundDebitAmount = 0;
    let capitalFundCreditAmount = 0;

    // Analyze each journal item to determine the correct posting (SAME LOGIC AS CREATE)
    for (const item of updatedItemDetails) {
      const ledger = ledgers.find(
        (l) => l._id.toString() === item.ledgerId.toString()
      );

      if (ledger && ledger.headOfAccountId) {
        const headOfAccountName =
          ledger.headOfAccountId.headOfAccountName.toLowerCase();
        const debitAmount = parseFloat(item.debitAmount) || 0;
        const amount = parseFloat(item.amount) || 0;

        // Scenario analysis based on your requirements (SAME AS CREATE)
        if (headOfAccountName === "income") {
          if (amount > 0) {
            // Income with credit amount → Net Surplus Debit, Capital Fund Credit
            netSurplusDebitAmount += amount;
            capitalFundCreditAmount += amount;
          }
          if (debitAmount > 0) {
            // Income with debit amount → Net Surplus Credit, Capital Fund Debit
            netSurplusCreditAmount += debitAmount;
            capitalFundDebitAmount += debitAmount;
          }
        } else if (headOfAccountName === "expenses") {
          if (amount > 0) {
            // Expenses with credit amount → Net Surplus Debit, Capital Fund Credit
            netSurplusDebitAmount += amount;
            capitalFundCreditAmount += amount;
          }
          if (debitAmount > 0) {
            // Expenses with debit amount → Net Surplus Credit, Capital Fund Debit
            netSurplusCreditAmount += debitAmount;
            capitalFundDebitAmount += debitAmount;
          }
        }
      }
    }

    // Round to two decimals
    netSurplusDebitAmount = toTwoDecimals(netSurplusDebitAmount);
    netSurplusCreditAmount = toTwoDecimals(netSurplusCreditAmount);
    capitalFundDebitAmount = toTwoDecimals(capitalFundDebitAmount);
    capitalFundCreditAmount = toTwoDecimals(capitalFundCreditAmount);

    // Check if we need to completely remove entries (both debit and credit are 0)
    const hasNetSurplusEntries =
      netSurplusDebitAmount > 0 || netSurplusCreditAmount > 0;
    const hasCapitalFundEntries =
      capitalFundDebitAmount > 0 || capitalFundCreditAmount > 0;

    // Handle Net Surplus/(Deficit) ledger
    if (!hasNetSurplusEntries) {
      // Remove the entry completely if no amounts
      await removeReceiptEntryFromLedger(
        schoolId,
        academicYear,
        id,
        netSurplusDeficitLedger._id,
        session
      );
    } else {
      // Update Net Surplus/(Deficit) ledger with correct debit/credit amounts
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        existingReceipt._id,
        netSurplusDebitAmount,
        netSurplusCreditAmount,
        session
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        session
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        session
      );
    }

    // Handle Capital Fund ledger
    if (!hasCapitalFundEntries) {
      // Remove the entry completely if no amounts
      await removeReceiptEntryFromLedger(
        schoolId,
        academicYear,
        id,
        capitalFundLedger._id,
        session
      );
    } else {
      // Update Capital Fund ledger with correct debit/credit amounts
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        existingReceipt._id,
        capitalFundDebitAmount,
        capitalFundCreditAmount,
        session
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        session
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        session
      );
    }

    // =====End of Net Surplus/(Deficit)...Capital Fund=====

    // --- Step E: Propagate changes to subsequent academic years ---
    const affectedLedgerIds = new Set([...ledgerIdsToUpdate]);

    // Also include Net Surplus/(Deficit) and Capital Fund if they were affected
    if (netSurplusDeficitLedger) {
      affectedLedgerIds.add(netSurplusDeficitLedger._id.toString());
    }
    if (capitalFundLedger) {
      affectedLedgerIds.add(capitalFundLedger._id.toString());
    }

    // FIXED: Include ALL ledgers that need propagation
    const allLedgersToPropagate = new Set([...affectedLedgerIds]);

    // FIXED: CRITICAL - Also include ALL old item ledgers
    for (const oldLedgerId of oldItemLedgerIds) {
      if (oldLedgerId) {
        allLedgersToPropagate.add(oldLedgerId);
      }
    }

    console.log(
      `All ledger IDs for propagation:`,
      Array.from(allLedgersToPropagate)
    );

    // Propagate changes for each affected ledger
    for (const ledgerId of allLedgersToPropagate) {
      try {
        await propagateBalanceChangeToNextYear(
          schoolId,
          academicYear,
          ledgerId,
          session
        );
      } catch (propagationError) {
        console.error(
          `Error propagating changes for ledger ${ledgerId}:`,
          propagationError
        );
        // Don't throw here - we want to continue with other ledgers
      }
    }

    // =====End of Net Surplus/(Deficit)...Capital Fund=====

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Receipt updated successfully!",
      data: existingReceipt,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error updating Receipt Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
