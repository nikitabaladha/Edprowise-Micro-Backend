import mongoose from "mongoose";
import Journal from "../../../models/Journal.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

// Helper function to remove journal entry from balances
async function removeJournalEntryFromBalances(
  schoolId,
  academicYear,
  journalEntryId,
  session = null
) {
  // Find all OpeningClosingBalance records that have this journal entry
  const balanceRecords = await OpeningClosingBalance.find({
    schoolId,
    academicYear,
    "balanceDetails.entryId": journalEntryId,
  }).session(session || null);

  for (const record of balanceRecords) {
    // Remove the entry from balance details
    record.balanceDetails = record.balanceDetails.filter(
      (detail) => detail.entryId?.toString() !== journalEntryId.toString()
    );

    await record.save({ session });
  }
}

// Helper function to aggregate amounts by ledgerId for journal entries
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

// Helper function to recalculate ledger balances from scratch
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
  }).session(session || null);

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session || null);

  const balanceType = ledger?.balanceType || "Debit";

  // Sort all entries by date, then by _id for consistent same-day order
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  // Find the initial opening balance from the ledger
  let currentBalance = ledger?.openingBalance || 0;

  // Process each balance detail in chronological order
  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    // Set the opening balance for this entry
    detail.openingBalance = currentBalance;

    // Calculate the closing balance based on the balance type
    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    // Update current balance for the next entry
    currentBalance = detail.closingBalance;
  }

  await record.save({ session });
}

// Helper function to recalculate all affected ledgers for journal entries
async function recalculateAllAffectedLedgers(
  schoolId,
  academicYear,
  itemDetails,
  session = null
) {
  // Store all ledger IDs that need to be recalculated
  const ledgerIdsToRecalculate = new Set();

  // Add all ledgers from item details
  const ledgerAmounts = aggregateAmountsByLedger(itemDetails);
  for (const [ledgerId] of ledgerAmounts) {
    ledgerIdsToRecalculate.add(ledgerId);
  }

  // Recalculate balances for all affected ledgers
  for (const ledgerId of ledgerIdsToRecalculate) {
    await recalculateLedgerBalances(schoolId, academicYear, ledgerId, session);
  }
}

// Helper function to recalculate all balances after a specific date
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
  }).session(session || null);

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

  const previousBalance =
    startIndex > 0
      ? record.balanceDetails[startIndex - 1].closingBalance
      : record.balanceDetails[0].openingBalance;

  let currentBalance = previousBalance;

  for (let i = startIndex; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    detail.openingBalance = currentBalance;
    detail.closingBalance = currentBalance + detail.debit - detail.credit;
    currentBalance = detail.closingBalance;
  }

  await record.save({ session });
}

async function cancelById(req, res) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const schoolId = req.user?.schoolId;
      const { id, academicYear } = req.params;

      if (!schoolId) {
        throw new Error("Access denied: Unauthorized request.");
      }

      // Find the journal entry with all details
      const existingJournal = await Journal.findOne({
        _id: id,
        schoolId,
        academicYear,
      }).session(session);

      if (!existingJournal) {
        throw new Error("Journal not found.");
      }

      // Check if already cancelled
      if (existingJournal.status === "Cancelled") {
        throw new Error("Journal is already cancelled.");
      }

      // Store the entry details before cancellation for balance recalculation
      const itemDetails = existingJournal.itemDetails;

      // Update status to "Cancelled"
      existingJournal.status = "Cancelled";
      await existingJournal.save({ session });

      // Remove this journal entry from all OpeningClosingBalance records
      await removeJournalEntryFromBalances(
        schoolId,
        academicYear,
        existingJournal._id,
        session
      );

      // Recalculate balances for all affected ledgers
      await recalculateAllAffectedLedgers(
        schoolId,
        academicYear,
        itemDetails,
        session
      );

      // Find the TotalNetdeficitNetSurplus record
      let totalNetRecord = await TotalNetdeficitNetSurplus.findOne({
        schoolId,
        academicYear,
      }).session(session);

      if (totalNetRecord) {
        // Remove the entry for this payment
        const originalLength = totalNetRecord.balanceDetails.length;
        totalNetRecord.balanceDetails = totalNetRecord.balanceDetails.filter(
          (detail) => detail.entryId?.toString() !== id.toString()
        );

        // Only save if something was actually removed
        if (totalNetRecord.balanceDetails.length !== originalLength) {
          // Sort balanceDetails by date
          totalNetRecord.balanceDetails.sort(
            (a, b) => new Date(a.entryDate) - new Date(b.entryDate)
          );

          await totalNetRecord.save({ session });
        }
      }

      // =====Net Surplus/(Deficit)...Capital Fund=====

      // =====Start Of Net Surplus/(Deficit)...Capital Fund=====

      // Get all unique ledger IDs from itemDetails
      const uniqueLedgerIds = [
        ...new Set(existingJournal.itemDetails.map((item) => item.ledgerId)),
      ];

      // Find ledgers with their Head of Account information
      const ledgers = await Ledger.find({
        _id: { $in: uniqueLedgerIds },
      })
        .populate("headOfAccountId")
        .session(session);

      // Calculate income and expenses totals (same logic as create/update)
      // Initialize amounts for both ledgers (same logic as create/update)
      let netSurplusDebitAmount = 0;
      let netSurplusCreditAmount = 0;
      let capitalFundDebitAmount = 0;
      let capitalFundCreditAmount = 0;

      for (const item of existingJournal.itemDetails) {
        const ledger = ledgers.find(
          (l) => l._id.toString() === item.ledgerId.toString()
        );

        if (ledger && ledger.headOfAccountId) {
          const headOfAccountName = ledger.headOfAccountId.headOfAccountName;
          const debitAmount = parseFloat(item.debitAmount) || 0;
          const creditAmount = parseFloat(item.creditAmount) || 0;

          // Scenario analysis based on your requirements (SAME AS CREATE/UPDATE)
          if (headOfAccountName === "income") {
            if (creditAmount > 0) {
              // Income with credit amount → Net Surplus Debit, Capital Fund Credit
              netSurplusDebitAmount += creditAmount;
              capitalFundCreditAmount += creditAmount;
            }
            if (debitAmount > 0) {
              // Income with debit amount → Net Surplus Credit, Capital Fund Debit
              netSurplusCreditAmount += debitAmount;
              capitalFundDebitAmount += debitAmount;
            }
          } else if (headOfAccountName === "expenses") {
            if (creditAmount > 0) {
              // Expenses with credit amount → Net Surplus Debit, Capital Fund Credit
              netSurplusDebitAmount += creditAmount;
              capitalFundCreditAmount += creditAmount;
            }
            if (debitAmount > 0) {
              // Expenses with debit amount → Net Surplus Credit, Capital Fund Debit
              netSurplusCreditAmount += debitAmount;
              capitalFundDebitAmount += debitAmount;
            }
          }
        }
      }

      // ========= Net Surplus/(Deficit) Ledger ===========
      const netSurplusDeficitLedger = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: "Net Surplus/(Deficit)",
      }).session(session);

      if (netSurplusDeficitLedger) {
        // Remove the entry from Net Surplus/(Deficit) ledger
        await removeJournalEntryFromBalances(
          schoolId,
          academicYear,
          existingJournal._id,
          session
        );

        // Recalculate balances for Net Surplus/(Deficit) ledger
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
          existingJournal.entryDate,
          session
        );
      }

      // ========= Capital Fund Ledger ===========
      const capitalFundLedger = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: "Capital Fund",
      }).session(session);

      if (capitalFundLedger) {
        // Remove the entry from Capital Fund ledger
        await removeJournalEntryFromBalances(
          schoolId,
          academicYear,
          existingJournal._id,
          session
        );

        // Recalculate balances for Capital Fund ledger
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
          existingJournal.entryDate,
          session
        );
      }

      return res.status(200).json({
        hasError: false,
        message: "Journal cancelled successfully.",
        data: existingJournal,
      });
    });
  } catch (error) {
    console.error("Error cancelling Journal:", error);

    // Handle specific error types
    if (
      error.message.includes("Access denied") ||
      error.message.includes("Journal not found") ||
      error.message.includes("already cancelled")
    ) {
      return res.status(400).json({
        hasError: true,
        message: error.message,
      });
    }

    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  } finally {
    // Always end the session, regardless of success or failure
    await session.endSession();
  }
}

export default cancelById;
