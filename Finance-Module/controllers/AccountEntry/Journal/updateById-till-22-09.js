// see for example if i have 2 entries on same date like 26-09-2025

// enrty     HeadofAccount	BS&P&LLedger	       GroupLedger	Ledger	      OpeningBalance  Debit	Credit Closing Balance
// entry-1.  Liabilities	  Current Liabilities	 Net Deficit	TDS Deducted. -1000.          100.     0.     -900
// entry-2.  Liabilities	  Current Liabilities	 Net Deficit. TDS Deducted  -900.           100      0.     -800

// then if i change entry one like for debit insted of 100 i do 200 then it must be like

// enrty     HeadofAccount	BS&P&LLedger	       GroupLedger	Ledger	      OpeningBalance  Debit	Credit Closing Balance
// entry-1.  Liabilities	  Current Liabilities	 Net Deficit	TDS Deducted. -1000.          200.     0.     -800
// entry-2.  Liabilities	  Current Liabilities	 Net Deficit. TDS Deducted. -800.           100      0.     -700

// but here it is changing the place of enrty1 and entry 2 and stores wrong value
// enrty     HeadofAccount	BS&P&LLedger	       GroupLedger	Ledger	      OpeningBalance  Debit	Credit Closing Balance
// entry-2.  Liabilities	  Current Liabilities	 Net Deficit	TDS Deducted. -900.           100.     0.     -800
// entry-1.  Liabilities	  Current Liabilities	 Net Deficit. TDS Deducted. -800.           200      0.     -600

// why why why?

// first time entry

// _id
// 68d6568e1090de3be0c9bf3d
// schoolId
// "SID144732"
// academicYear
// "2025-2026"
// ledgerId
// 68a9a476f46f002cf6a5433e

// balanceDetails
// Array (2)

// 0
// Object
// entryId
// "68d6568e1090de3be0c9bf37"
// entryDate
// 2025-09-26T00:00:00.000+00:00
// openingBalance
// -1000
// debit
// 100
// credit
// 0
// closingBalance
// -900
// _id
// 68d6568e1090de3be0c9bf3e

// 1
// Object
// entryId
// "68d6569d1090de3be0c9bf5e"
// entryDate
// 2025-09-26T00:00:00.000+00:00
// openingBalance
// -900
// debit
// 100
// credit
// 0
// closingBalance
// -800
// _id
// 68d6569d1090de3be0c9bf65
// balanceType
// "Credit"
// createdAt
// 2025-09-26T09:02:06.371+00:00
// updatedAt
// 2025-09-26T09:02:21.880+00:00
// __v
// 3

// after update it is like

// _id
// 68d6568e1090de3be0c9bf3d
// schoolId
// "SID144732"
// academicYear
// "2025-2026"
// ledgerId
// 68a9a476f46f002cf6a5433e

// balanceDetails
// Array (2)

// 0
// Object
// entryId
// "68d6569d1090de3be0c9bf5e"
// entryDate
// 2025-09-26T00:00:00.000+00:00
// openingBalance
// -900
// debit
// 100
// credit
// 0
// closingBalance
// -800
// _id
// 68d6569d1090de3be0c9bf65

// 1
// Object
// entryId
// "68d6568e1090de3be0c9bf37"
// entryDate
// 2025-09-26T00:00:00.000+00:00
// openingBalance
// -800
// debit
// 200
// credit
// 0
// closingBalance
// -600
// _id
// 68d656f3b1780ece2e49ba7b
// balanceType
// "Credit"
// createdAt
// 2025-09-26T09:02:06.371+00:00
// updatedAt
// 2025-09-26T09:03:47.988+00:00
// __v
// 7

import mongoose from "mongoose";
import Journal from "../../../models/Journal.js";
import JournalValidator from "../../../validators/JournalValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
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

  // FIXED: Sort by date and entrySequence
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // FIXED: Ensure sequences are continuous and properly ordered
  let currentDate = null;
  let currentSequence = 0;

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    const detailDate = new Date(detail.entryDate).toDateString();

    if (currentDate !== detailDate) {
      // New date, reset sequence
      currentDate = detailDate;
      currentSequence = 1;
    } else {
      // Same date, increment sequence
      currentSequence++;
    }

    // Ensure proper sequencing
    detail.entrySequence = currentSequence;
  }

  // Re-sort after sequence correction
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Now recalculate balances
  let currentBalance = toTwoDecimals(record.balanceDetails[0].openingBalance);

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      // For first entry, use the stored opening balance
      currentBalance = toTwoDecimals(detail.openingBalance);
    } else {
      // For subsequent entries, opening balance is previous closing balance
      const previousDetail = record.balanceDetails[i - 1];

      // FIXED: Only update opening balance if dates are different or sequence is consecutive
      const currentDate = new Date(detail.entryDate).toDateString();
      const previousDate = new Date(previousDetail.entryDate).toDateString();

      if (
        currentDate !== previousDate ||
        detail.entrySequence - previousDetail.entrySequence === 1
      ) {
        detail.openingBalance = toTwoDecimals(previousDetail.closingBalance);
      }
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

  // FIXED: Sort by date and entrySequence
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
  journalId,
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

  // FIXED: Proper sorting by date and sequence
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Find existing entry
  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) => detail.entryId?.toString() === journalId.toString()
  );

  let entrySequence;

  if (existingEntryIndex !== -1) {
    // Update existing entry
    const existing = record.balanceDetails[existingEntryIndex];
    entrySequence = existing.entrySequence;

    // Calculate correct opening balance for this position
    let effectiveOpeningBalance = openingBalance;

    if (existingEntryIndex > 0) {
      // Use previous entry's closing balance
      effectiveOpeningBalance = toTwoDecimals(
        record.balanceDetails[existingEntryIndex - 1].closingBalance
      );
    } else {
      // First entry - find last balance before this date
      const entriesBeforeDate = toTwoDecimals(
        record.balanceDetails.filter(
          (detail) => new Date(detail.entryDate) < new Date(entryDate)
        )
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
        // No entries before, use ledger opening balance
        effectiveOpeningBalance = openingBalance;
      }
    }

    const closingBalance = toTwoDecimals(
      effectiveOpeningBalance + debitAmount - creditAmount
    );

    // Update the entry
    existing.debit = debitAmount;
    existing.credit = creditAmount;
    existing.entryDate = entryDate;
    existing.openingBalance = effectiveOpeningBalance;
    existing.closingBalance = closingBalance;
  } else {
    // New entry - find correct sequence
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
      entryId: journalId,
    };

    record.balanceDetails.push(newBalanceDetail);
  }

  // FIXED: Proper sorting after update
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  await record.save({ session });
  return record;
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

    const { error } = JournalValidator.JournalValidatorUpdate.validate(
      req.body
    );
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const { entryDate, documentDate, narration, itemDetails, status } =
      req.body;

    const existingJournal = await Journal.findOne({
      _id: id,
      schoolId,
      academicYear,
    }).session(session);

    if (!existingJournal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "Journal not found.",
      });
    }

    // Store old item details for comparison
    const oldItemDetails = existingJournal.itemDetails;
    const oldEntryDate = existingJournal.entryDate;

    // Handle uploaded files (if provided)
    const { documentImage } = req.files || {};

    if (documentImage?.[0]) {
      const documentImagePath = documentImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/DocumentImageForJournal"
        : "/Documents/FinanceModule/DocumentImageForJournal";

      existingJournal.documentImage = `${documentImagePath}/${documentImage[0].filename}`;
    }

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      debitAmount: toTwoDecimals(item.debitAmount) || 0,
      creditAmount: toTwoDecimals(item.creditAmount) || 0,
    }));

    const subTotalOfDebit = toTwoDecimals(
      updatedItemDetails.reduce((sum, item) => sum + item.debitAmount, 0)
    );

    const subTotalOfCredit = toTwoDecimals(
      updatedItemDetails.reduce((sum, item) => sum + item.creditAmount, 0)
    );

    const totalAmountOfDebit = subTotalOfDebit || 0;
    const totalAmountOfCredit = subTotalOfCredit || 0;

    if (totalAmountOfDebit !== totalAmountOfCredit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Total Debit and Credit amounts must be equal.",
      });
    }

    // Update fields
    existingJournal.entryDate = entryDate || existingJournal.entryDate;
    existingJournal.documentDate = documentDate || existingJournal.documentDate;
    existingJournal.itemDetails = updatedItemDetails;
    existingJournal.subTotalOfDebit = subTotalOfDebit;
    existingJournal.subTotalOfCredit = subTotalOfCredit;
    existingJournal.totalAmountOfDebit = totalAmountOfDebit;
    existingJournal.totalAmountOfCredit = totalAmountOfCredit;
    existingJournal.narration = narration || existingJournal.narration;
    existingJournal.status = status || existingJournal.status;

    await existingJournal.save({ session });

    // Step 1: Remove old journal entry from OpeningClosingBalance
    const allLedgerIds = new Set();

    // Collect all ledger IDs from old and new item details
    oldItemDetails.forEach((item) =>
      allLedgerIds.add(item.ledgerId.toString())
    );
    updatedItemDetails.forEach((item) =>
      allLedgerIds.add(item.ledgerId.toString())
    );

    // Remove the journal entry from all affected ledgers
    for (const ledgerId of allLedgerIds) {
      const record = await OpeningClosingBalance.findOne({
        schoolId,
        academicYear,
        ledgerId,
      }).session(session);

      if (record) {
        // Remove the entry with this journal ID
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

      // Also recalculate all entries after the old entry date
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        oldEntryDate,
        session
      );
    }

    // Step 3: Add the updated journal entry to OpeningClosingBalance
    const ledgerIdsToUpdate = new Set();

    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);
    for (const [ledgerId, amounts] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        existingJournal._id,
        amounts.debitAmount, // Aggregated debit
        amounts.creditAmount, // Aggregated credit
        session
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // Step 4: Recalculate all ledgers that were updated
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        ledgerId,
        session
      );

      // Also recalculate all entries after this date to handle backdated entries
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        existingJournal.entryDate,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Journal updated successfully!",
      data: existingJournal,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error updating Journal Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default updateById;
