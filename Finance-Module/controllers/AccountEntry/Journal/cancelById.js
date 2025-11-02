import mongoose from "mongoose";
import Journal from "../../../models/Journal.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

// Helper function to remove journal entry from balances
async function removeJournalEntryFromBalances(
  schoolId,
  financialYear,
  journalEntryId,
  session = null
) {
  // Find all OpeningClosingBalance records that have this journal entry
  const balanceRecords = await OpeningClosingBalance.find({
    schoolId,
    financialYear,
    "balanceDetails.entryId": journalEntryId,
  }).session(session || null);

  for (const record of balanceRecords) {
    // Remove the entry from balance details
    const originalLength = record.balanceDetails.length;
    record.balanceDetails = record.balanceDetails.filter(
      (detail) => detail.entryId?.toString() !== journalEntryId.toString()
    );

    if (record.balanceDetails.length === originalLength) continue; // nothing removed

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

    // Recalculate opening and closing balances - FIXED: Use toTwoDecimals
    for (let i = 0; i < record.balanceDetails.length; i++) {
      const detail = record.balanceDetails[i];
      if (i === 0) {
        // First entry uses ledger opening balance
        const ledger = await Ledger.findOne({
          schoolId,
          financialYear,
          _id: record.ledgerId,
        }).session(session);
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
  financialYear,
  ledgerId,
  session = null
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    financialYear,
    ledgerId,
  }).session(session || null);

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    financialYear,
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
  let currentBalance = toTwoDecimals(ledger?.openingBalance || 0);

  // Process each balance detail in chronological order
  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    // Set the opening balance for this entry
    detail.openingBalance = currentBalance;

    // Calculate the closing balance
    detail.closingBalance = toTwoDecimals(
      currentBalance + detail.debit - detail.credit
    );

    // Update current balance for the next entry
    currentBalance = toTwoDecimals(detail.closingBalance);
  }

  await record.save({ session });
}
// Helper function to recalculate all affected ledgers for journal entries
async function recalculateAllAffectedLedgers(
  schoolId,
  financialYear,
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
    await recalculateLedgerBalances(schoolId, financialYear, ledgerId, session);
  }
}

// Helper function to recalculate all balances after a specific date
async function recalculateAllBalancesAfterDate(
  schoolId,
  financialYear,
  ledgerId,
  date,
  session = null
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    financialYear,
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

async function propagateBalanceChangeToNextYear(
  schoolId,
  currentFinancialYear,
  ledgerId,
  session
) {
  try {
    // Find the current ledger to get its details
    const currentLedger = await Ledger.findOne({
      schoolId,
      financialYear: currentFinancialYear,
      _id: ledgerId,
    }).session(session);

    if (!currentLedger) {
      console.log(`Ledger ${ledgerId} not found in ${currentFinancialYear}`);
      return;
    }

    // Calculate next academic year
    const [yearPart1, yearPart2] = currentFinancialYear.split("-");
    const nextFinancialYear = `${parseInt(yearPart1) + 1}-${
      parseInt(yearPart2) + 1
    }`;

    // Find the next year's ledger that has the CURRENT ledger as parent
    const nextYearLedger = await Ledger.findOne({
      schoolId,
      financialYear: nextFinancialYear,
      parentLedgerId: currentLedger._id,
    }).session(session);

    if (!nextYearLedger) {
      console.log(`No next year ledger found for ${currentLedger.ledgerName}`);
      return; // No next year ledger found
    }

    // Get the current year's balance record for this ledger
    const currentYearBalance = await OpeningClosingBalance.findOne({
      schoolId,
      financialYear: currentFinancialYear,
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
        financialYear: nextFinancialYear,
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
      financialYear: nextFinancialYear,
      ledgerId: nextYearLedger._id,
    }).session(session);

    if (!nextYearOpeningBalance) {
      // Create new OpeningClosingBalance record if it doesn't exist
      nextYearOpeningBalance = new OpeningClosingBalance({
        schoolId,
        financialYear: nextFinancialYear,
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
      nextFinancialYear,
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

async function cancelById(req, res) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const schoolId = req.user?.schoolId;
      const { id, financialYear } = req.params;

      if (!schoolId) {
        throw new Error("Access denied: Unauthorized request.");
      }

      // Find the journal entry with all details
      const existingJournal = await Journal.findOne({
        _id: id,
        schoolId,
        financialYear,
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
        financialYear,
        existingJournal._id,
        session
      );

      // Recalculate balances for all affected ledgers
      await recalculateAllAffectedLedgers(
        schoolId,
        financialYear,
        itemDetails,
        session
      );

      // Find the TotalNetdeficitNetSurplus record
      let totalNetRecord = await TotalNetdeficitNetSurplus.findOne({
        schoolId,
        financialYear,
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
        financialYear,
        ledgerName: "Net Surplus/(Deficit)",
      }).session(session);

      if (netSurplusDeficitLedger) {
        // Remove the entry from Net Surplus/(Deficit) ledger
        await removeJournalEntryFromBalances(
          schoolId,
          financialYear,
          existingJournal._id,
          session
        );

        // Recalculate balances for Net Surplus/(Deficit) ledger
        await recalculateLedgerBalances(
          schoolId,
          financialYear,
          netSurplusDeficitLedger._id,
          session
        );
        await recalculateAllBalancesAfterDate(
          schoolId,
          financialYear,
          netSurplusDeficitLedger._id,
          existingJournal.entryDate,
          session
        );
      }

      // ========= Capital Fund Ledger ===========
      const capitalFundLedger = await Ledger.findOne({
        schoolId,
        financialYear,
        ledgerName: "Capital Fund",
      }).session(session);

      if (capitalFundLedger) {
        // Remove the entry from Capital Fund ledger
        await removeJournalEntryFromBalances(
          schoolId,
          financialYear,
          existingJournal._id,
          session
        );

        // Recalculate balances for Capital Fund ledger
        await recalculateLedgerBalances(
          schoolId,
          financialYear,
          capitalFundLedger._id,
          session
        );
        await recalculateAllBalancesAfterDate(
          schoolId,
          financialYear,
          capitalFundLedger._id,
          existingJournal.entryDate,
          session
        );
      }

      // ========= NEW: Propagate changes to subsequent academic years =========

      // Store all ledger IDs that were affected by this journal
      const ledgerIdsToUpdate = new Set();

      // 1. Add all ledgers from item details
      const ledgerAmounts = aggregateAmountsByLedger(itemDetails);
      for (const [ledgerId] of ledgerAmounts) {
        ledgerIdsToUpdate.add(ledgerId);
      }

      // 2. Also include Net Surplus/(Deficit) and Capital Fund if they were affected
      if (netSurplusDeficitLedger) {
        ledgerIdsToUpdate.add(netSurplusDeficitLedger._id.toString());
      }
      if (capitalFundLedger) {
        ledgerIdsToUpdate.add(capitalFundLedger._id.toString());
      }

      console.log(
        `All ledger IDs for propagation in journal cancel:`,
        Array.from(ledgerIdsToUpdate)
      );

      // Propagate changes for each affected ledger
      for (const ledgerId of ledgerIdsToUpdate) {
        try {
          await propagateBalanceChangeToNextYear(
            schoolId,
            financialYear,
            ledgerId,
            session
          );
        } catch (propagationError) {
          console.error(
            `Error propagating changes for ledger ${ledgerId} during journal cancel:`,
            propagationError
          );
          // Don't throw here - we want to continue with other ledgers
        }
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
