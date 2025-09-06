import mongoose from "mongoose";
import Contra from "../../../models/Contra.js";
import ContraValidator from "../../../validators/CustomizeEntryForContraValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

// Helper functions with session support
async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  session = null
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
    openingBalance = ledger.openingBalance || 0;
  }

  let record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session);

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
  contraId,
  debitAmount = 0,
  creditAmount = 0,
  session = null
) {
  debitAmount = Number(debitAmount);
  creditAmount = Number(creditAmount);

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate,
      session
    );

  // Determine effective opening balance
  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) <= new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  let effectiveOpeningBalance = openingBalance;
  if (previousBalanceDetails.length > 0) {
    effectiveOpeningBalance = previousBalanceDetails[0].closingBalance;
  }

  // Calculate closing balance
  let closingBalance;
  if (balanceType === "Debit") {
    closingBalance = effectiveOpeningBalance + debitAmount - creditAmount;
  } else {
    closingBalance = effectiveOpeningBalance + debitAmount - creditAmount;
  }

  // Check if exact same entry already exists
  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) =>
      new Date(detail.entryDate).getTime() === new Date(entryDate).getTime() &&
      detail.entryId?.toString() === contraId.toString()
  );

  if (existingEntryIndex !== -1) {
    record.balanceDetails[existingEntryIndex] = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: contraId,
    };
  } else {
    const newBalanceDetail = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: contraId,
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

  await record.save({ session });
  return record;
}

async function recalculateLedgerBalances(
  schoolId,
  academicYear,
  ledgerId,
  session = null
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

  // Sort all entries by date, then by _id for consistent same-day order
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

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

  await record.save({ session });
}

async function recalculateAllBalancesAfterDate(
  schoolId,
  academicYear,
  ledgerId,
  date,
  session = null
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session);

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
    }).session(session);

    const balanceType = ledger?.balanceType || "Debit";

    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save({ session });
}

function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const debitAmount = parseFloat(item.debitAmount) || 0;
    const creditAmount = parseFloat(item.creditAmount) || 0;

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

    // Step 1: Remove old contra entry from OpeningClosingBalance
    const allLedgerIds = new Set();

    // Collect all ledger IDs from old item details
    oldItemDetails.forEach((item) => {
      allLedgerIds.add(item.ledgerId.toString());
      if (item.ledgerIdOfCashAccount) {
        allLedgerIds.add(item.ledgerIdOfCashAccount.toString());
      }
    });

    // Remove the contra entry from all affected ledgers
    for (const ledgerId of allLedgerIds) {
      const record = await OpeningClosingBalance.findOne({
        schoolId,
        academicYear,
        ledgerId,
      }).session(session);

      if (record) {
        // Remove the entry with this contra ID
        record.balanceDetails = record.balanceDetails.filter(
          (detail) => detail.entryId?.toString() !== id.toString()
        );
        await record.save({ session });
      }
    }

    // Step 2: Recalculate balances for all affected ledgers after removing the old entry
    for (const ledgerId of allLedgerIds) {
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
        oldEntryDate,
        session
      );
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
