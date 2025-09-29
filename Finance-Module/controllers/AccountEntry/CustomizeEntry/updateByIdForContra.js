import mongoose from "mongoose";
import Contra from "../../../models/Contra.js";
import ContraValidator from "../../../validators/CustomizeEntryForContraValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";

import { hasBankOrCashLedger } from "../../CommonFunction/CommonFunction.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
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
  contraEntryId,
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
    (detail) => detail.entryId?.toString() === contraEntryId.toString()
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
      entryId: contraEntryId,
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

async function removeContraEntryFromLedger(
  schoolId,
  academicYear,
  contraEntryId,
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
  s;
  record.balanceDetails = record.balanceDetails.filter(
    (detail) => detail.entryId?.toString() !== contraEntryId.toString()
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
    const creditAmount = toTwoDecimals(item.creditAmount) || 0;

    if (ledgerMap.has(ledgerId)) {
      const existing = ledgerMap.get(ledgerId);
      ledgerMap.set(ledgerId, {
        debitAmount: existing.debitAmount + debitAmount,
        creditAmount: existing.creditAmount + creditAmount,
      });
    } else {
      ledgerMap.set(ledgerId, {
        debitAmount: debitAmount,
        creditAmount: creditAmount,
      });
    }
  });

  return ledgerMap;
}

export async function updateById(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schoolId = req.user?.schoolId;
    const { id, academicYear } = req.params;

    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const { error } = ContraValidator.ContraValidatorUpdate.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
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

    const hasValidLedger = await hasBankOrCashLedger(
      schoolId,
      academicYear,
      itemDetails
    );

    if (!hasValidLedger) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message:
          "At least one ledger must have Group Ledger Name as 'Bank' or 'Cash'",
      });
    }

    const existingContra = await Contra.findOne({
      _id: id,
      schoolId,
      academicYear,
    }).session(session);

    if (!existingContra) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "Contra not found.",
      });
    }

    const oldItemLedgerIds = existingContra.itemDetails.map((item) =>
      item.ledgerId?.toString()
    );

    // Store old data for comparison and cleanup
    const oldItemDetails = existingContra.itemDetails;
    const oldEntryDate = existingContra.entryDate;

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

    const subTotalOfDebit = toTwoDecimals(
      updatedItemDetails.reduce((sum, item) => sum + item.debitAmount, 0)
    );

    const subTotalOfCredit = toTwoDecimals(
      updatedItemDetails.reduce((sum, item) => sum + item.creditAmount, 0)
    );

    const totalAmountOfDebit = subTotalOfDebit;
    const totalAmountOfCredit = subTotalOfCredit;

    if (totalAmountOfDebit !== totalAmountOfCredit) {
      await session.abortTransaction();
      session.endSession();
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
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          hasError: true,
          message:
            "LedgerId Of CashAccount is required for Cash Deposited or Cash Withdrawn entries.",
        });
      }
    }

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

    await existingContra.save({ session });

    // Get new ledger IDs
    const newItemLedgerIds = updatedItemDetails.map((item) =>
      item.ledgerId?.toString()
    );

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
        await removeContraEntryFromLedger(
          schoolId,
          academicYear,
          id,
          oldLedgerId,
          session
        );
      }
    }

    // Step 3: Add the updated contra entry to OpeningClosingBalance
    const ledgerIdsToUpdate = new Set();

    // Process based on contra entry type
    if (contraEntryName === "Cash Deposited") {
      // For Cash Deposited: Debit main ledger, Credit cash account
      for (const item of updatedItemDetails) {
        // Debit the main ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          item.ledgerId,
          existingContra.entryDate,
          existingContra._id,
          item.debitAmount,
          item.creditAmount,
          session
        );
        ledgerIdsToUpdate.add(item.ledgerId.toString());

        // Credit the cash account
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          item.ledgerIdOfCashAccount,
          existingContra.entryDate,
          existingContra._id,
          item.debitAmount,
          item.creditAmount,
          session
        );
        ledgerIdsToUpdate.add(item.ledgerIdOfCashAccount.toString());
      }
    } else if (contraEntryName === "Cash Withdrawn") {
      // For Cash Withdrawn: Credit main ledger, Debit cash account
      for (const item of updatedItemDetails) {
        // Credit the main ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          item.ledgerId,
          existingContra.entryDate,
          existingContra._id,
          item.debitAmount,
          item.creditAmount,
          session
        );
        ledgerIdsToUpdate.add(item.ledgerId.toString());

        // Debit the cash account
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          item.ledgerIdOfCashAccount,
          existingContra.entryDate,
          existingContra._id,
          item.debitAmount,
          item.creditAmount,
          session
        );
        ledgerIdsToUpdate.add(item.ledgerIdOfCashAccount.toString());
      }
    } else {
      // For Bank Transfer or empty/null contraEntryName: Process each item normally
      const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);
      for (const [ledgerId, amounts] of ledgerAmounts) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          existingContra.entryDate,
          existingContra._id,
          amounts.debitAmount, // Aggregated debit
          amounts.creditAmount, // Aggregated credit
          session
        );
        ledgerIdsToUpdate.add(ledgerId.toString());
      }
    }

    // Step 4: Recalculate all ledgers that were updated
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
        existingContra.entryDate,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Contra updated successfully!",
      data: existingContra,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error updating Contra Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
