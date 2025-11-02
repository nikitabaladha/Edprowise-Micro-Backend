import mongoose from "mongoose";
import Contra from "../../../models/Contra.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

// Helper function to remove contra entry from balances
async function removeContraEntryFromBalances(
  schoolId,
  financialYear,
  contraEntryId,
  session = null
) {
  // Find all OpeningClosingBalance records that have this contra entry
  const balanceRecords = await OpeningClosingBalance.find({
    schoolId,
    financialYear,
    "balanceDetails.entryId": contraEntryId,
  }).session(session || null);

  for (const record of balanceRecords) {
    // Remove the entry from balance details
    const originalLength = record.balanceDetails.length;
    record.balanceDetails = record.balanceDetails.filter(
      (detail) => detail.entryId?.toString() !== contraEntryId.toString()
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

// Helper function to aggregate amounts by ledgerId for contra entries
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

// Helper function to aggregate cash account amounts
function aggregateCashAccountAmounts(itemDetails) {
  const cashAccountMap = new Map();

  itemDetails.forEach((item) => {
    if (item.ledgerIdOfCashAccount) {
      const cashAccountId = item.ledgerIdOfCashAccount.toString();
      const debitAmount = parseFloat(item.debitAmount) || 0;
      const creditAmount = parseFloat(item.creditAmount) || 0;

      if (cashAccountMap.has(cashAccountId)) {
        const existing = cashAccountMap.get(cashAccountId);
        cashAccountMap.set(cashAccountId, {
          debitAmount: existing.debitAmount + debitAmount,
          creditAmount: existing.creditAmount + creditAmount,
        });
      } else {
        cashAccountMap.set(cashAccountId, {
          debitAmount: debitAmount,
          creditAmount: creditAmount,
        });
      }
    }
  });

  return cashAccountMap;
}

// Helper function to find TDS/TCS ledger - IMPROVED TO MATCH CREATE/UPDATE
async function findTDSorTCSLedger(
  schoolId,
  financialYear,
  TDSorTCS,
  session = null
) {
  if (!TDSorTCS) return null;

  // Use the exact same logic as your create function
  const ledgerNameToFind =
    TDSorTCS === "TDS" ? "TDS on Cash Withdrawn/Deposited" : "TCS";

  // Find the ledger with exact name match (same as create function)
  let tdsTcsLedger = await Ledger.findOne({
    schoolId,
    financialYear,
    ledgerName: { $regex: new RegExp(`^${ledgerNameToFind}$`, "i") },
  }).session(session || null);

  if (tdsTcsLedger) {
    return tdsTcsLedger;
  }

  // Fallback to group ledger search (same as your original logic)
  let tdsTcsGroupLedger = await GroupLedger.findOne({
    schoolId,
    financialYear,
    groupLedgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
  }).session(session || null);

  if (!tdsTcsGroupLedger) {
    tdsTcsGroupLedger = await GroupLedger.findOne({
      schoolId,
      financialYear,
      groupLedgerName: { $regex: new RegExp(TDSorTCS, "i") },
    }).session(session || null);
  }

  if (!tdsTcsGroupLedger) {
    return null;
  }

  tdsTcsLedger = await Ledger.findOne({
    schoolId,
    financialYear,
    groupLedgerId: tdsTcsGroupLedger._id,
    ledgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
  }).session(session || null);

  if (!tdsTcsLedger) {
    tdsTcsLedger = await Ledger.findOne({
      schoolId,
      financialYear,
      groupLedgerId: tdsTcsGroupLedger._id,
    }).session(session || null);
  }

  return tdsTcsLedger;
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

async function recalculateAllAffectedLedgers(
  schoolId,
  financialYear,
  itemDetails,
  contraEntryName,
  TDSorTCS,
  TDSTCSRateAmount,
  TDSorTCSLedgerId, // ADD THIS PARAMETER TO USE STORED LEDGER ID
  session = null
) {
  // Store all ledger IDs that need to be recalculated
  const ledgerIdsToRecalculate = new Set();

  // 1. Add main ledgers from item details
  const ledgerAmounts = aggregateAmountsByLedger(itemDetails);
  for (const [ledgerId] of ledgerAmounts) {
    ledgerIdsToRecalculate.add(ledgerId);
  }

  // 2. Add cash account ledgers if applicable
  if (
    ["Cash Deposited", "Cash Withdrawn", "Bank Transfer"].includes(
      contraEntryName
    )
  ) {
    const cashAccountAmounts = aggregateCashAccountAmounts(itemDetails);
    for (const [cashAccountId] of cashAccountAmounts) {
      ledgerIdsToRecalculate.add(cashAccountId);
    }
  }

  // 3. Add TDS/TCS ledger if applicable - IMPROVED LOGIC
  if (TDSorTCS && TDSTCSRateAmount > 0) {
    // First try to use the stored TDSorTCSLedgerId from the contra entry
    if (TDSorTCSLedgerId) {
      ledgerIdsToRecalculate.add(TDSorTCSLedgerId.toString());
    } else {
      // Fallback to finding the ledger if ID is not stored
      const tdsTcsLedger = await findTDSorTCSLedger(
        schoolId,
        financialYear,
        TDSorTCS,
        session
      );
      if (tdsTcsLedger) {
        ledgerIdsToRecalculate.add(tdsTcsLedger._id.toString());
      }
    }
  }

  // Recalculate balances for all affected ledgers
  for (const ledgerId of ledgerIdsToRecalculate) {
    await recalculateLedgerBalances(schoolId, financialYear, ledgerId, session);
  }
}

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
  }).session(session);

  if (!record || record.balanceDetails.length === 0) return;

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    if ((a.entrySequence || 0) !== (b.entrySequence || 0)) {
      return (a.entrySequence || 0) - (b.entrySequence || 0);
    }
    return a._id.toString().localeCompare(b._id.toString());
  });

  const startIndex = record.balanceDetails.findIndex(
    (detail) => new Date(detail.entryDate) > new Date(date)
  );
  if (startIndex === -1) return;

  let currentBalance =
    startIndex > 0
      ? toTwoDecimals(record.balanceDetails[startIndex - 1].closingBalance)
      : toTwoDecimals(record.balanceDetails[0].openingBalance);

  for (let i = startIndex; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    detail.openingBalance = currentBalance;
    detail.closingBalance =
      currentBalance + (detail.debit || 0) - (detail.credit || 0);
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

      // Find the contra entry with all details
      const existingContra = await Contra.findOne({
        _id: id,
        schoolId,
        financialYear,
      }).session(session);

      if (!existingContra) {
        throw new Error("Contra not found.");
      }

      // Check if already cancelled
      if (existingContra.status === "Cancelled") {
        throw new Error("Contra is already cancelled.");
      }

      // Store the entry details before cancellation for balance recalculation
      const itemDetails = existingContra.itemDetails;
      const contraEntryName = existingContra.contraEntryName;
      const TDSorTCS = existingContra.TDSorTCS;
      const TDSTCSRateAmount = existingContra.TDSTCSRateAmount || 0;
      const TDSorTCSLedgerId = existingContra.TDSorTCSLedgerId; // GET STORED LEDGER ID

      // Update status to "Cancelled"
      existingContra.status = "Cancelled";
      await existingContra.save({ session });

      // Remove this contra entry from all OpeningClosingBalance records
      await removeContraEntryFromBalances(
        schoolId,
        financialYear,
        existingContra._id,
        session
      );

      // Recalculate balances for all affected ledgers
      await recalculateAllAffectedLedgers(
        schoolId,
        financialYear,
        itemDetails,
        contraEntryName,
        TDSorTCS,
        TDSTCSRateAmount,
        TDSorTCSLedgerId, // PASS THE STORED LEDGER ID
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

      // =====Net Surplus/(Deficit)...Capital Fund=====

      // =====Start Of Net Surplus/(Deficit)...Capital Fund=====

      // Get all unique ledger IDs from itemDetails
      // =====Start Of Net Surplus/(Deficit)...Capital Fund=====

      // Get all unique ledger IDs from itemDetails (both ledgerId and ledgerIdOfCashAccount)
      const uniqueLedgerIds = [
        ...new Set(
          itemDetails
            .flatMap((item) => [item.ledgerId, item.ledgerIdOfCashAccount])
            .filter((id) => id) // Remove null/undefined
        ),
      ];

      // Find ledgers with their Head of Account information
      const ledgers = await Ledger.find({
        _id: { $in: uniqueLedgerIds },
      })
        .populate("headOfAccountId")
        .session(session);

      // Find the required ledgers
      const netSurplusDeficitLedger = await Ledger.findOne({
        schoolId,
        financialYear,
        ledgerName: "Net Surplus/(Deficit)",
      }).session(session);

      const capitalFundLedger = await Ledger.findOne({
        schoolId,
        financialYear,
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

      // Process based on contra entry type
      if (contraEntryName === "Cash Deposited") {
        // For Cash Deposited: ledgerId is debited, ledgerIdOfCashAccount is credited
        for (const item of itemDetails) {
          // Process main ledger (ledgerId) - DEBIT side
          const mainLedger = ledgers.find(
            (l) => l._id.toString() === item.ledgerId.toString()
          );
          if (mainLedger && mainLedger.headOfAccountId) {
            const headOfAccountName =
              mainLedger.headOfAccountId.headOfAccountName.toLowerCase();
            const debitAmount = parseFloat(item.debitAmount) || 0;

            if (headOfAccountName === "income") {
              // Income ledger with debit amount → Net Surplus Credit, Capital Fund Debit
              netSurplusCreditAmount += debitAmount;
              capitalFundDebitAmount += debitAmount;
            } else if (headOfAccountName === "expenses") {
              // Expenses ledger with debit amount → Net Surplus Credit, Capital Fund Debit
              netSurplusCreditAmount += debitAmount;
              capitalFundDebitAmount += debitAmount;
            }
          }

          // Process cash account (ledgerIdOfCashAccount) - CREDIT side
          if (item.ledgerIdOfCashAccount) {
            const cashLedger = ledgers.find(
              (l) => l._id.toString() === item.ledgerIdOfCashAccount.toString()
            );
            if (cashLedger && cashLedger.headOfAccountId) {
              const headOfAccountName =
                cashLedger.headOfAccountId.headOfAccountName.toLowerCase();
              const creditAmount = parseFloat(item.creditAmount) || 0;

              if (headOfAccountName === "income") {
                // Income ledger with credit amount → Net Surplus Debit, Capital Fund Credit
                netSurplusDebitAmount += creditAmount;
                capitalFundCreditAmount += creditAmount;
              } else if (headOfAccountName === "expenses") {
                // Expenses ledger with credit amount → Net Surplus Debit, Capital Fund Credit
                netSurplusDebitAmount += creditAmount;
                capitalFundCreditAmount += creditAmount;
              }
            }
          }
        }
      } else if (contraEntryName === "Cash Withdrawn") {
        // For Cash Withdrawn: ledgerId is credited, ledgerIdOfCashAccount is debited
        for (const item of itemDetails) {
          // Process main ledger (ledgerId) - CREDIT side
          const mainLedger = ledgers.find(
            (l) => l._id.toString() === item.ledgerId.toString()
          );
          if (mainLedger && mainLedger.headOfAccountId) {
            const headOfAccountName =
              mainLedger.headOfAccountId.headOfAccountName.toLowerCase();
            const creditAmount = parseFloat(item.creditAmount) || 0;

            if (headOfAccountName === "income") {
              // Income ledger with credit amount → Net Surplus Debit, Capital Fund Credit
              netSurplusDebitAmount += creditAmount;
              capitalFundCreditAmount += creditAmount;
            } else if (headOfAccountName === "expenses") {
              // Expenses ledger with credit amount → Net Surplus Debit, Capital Fund Credit
              netSurplusDebitAmount += creditAmount;
              capitalFundCreditAmount += creditAmount;
            }
          }

          // Process cash account (ledgerIdOfCashAccount) - DEBIT side
          if (item.ledgerIdOfCashAccount) {
            const cashLedger = ledgers.find(
              (l) => l._id.toString() === item.ledgerIdOfCashAccount.toString()
            );
            if (cashLedger && cashLedger.headOfAccountId) {
              const headOfAccountName =
                cashLedger.headOfAccountId.headOfAccountName.toLowerCase();
              const debitAmount = parseFloat(item.debitAmount) || 0;

              if (headOfAccountName === "income") {
                // Income ledger with debit amount → Net Surplus Credit, Capital Fund Debit
                netSurplusCreditAmount += debitAmount;
                capitalFundDebitAmount += debitAmount;
              } else if (headOfAccountName === "expenses") {
                // Expenses ledger with debit amount → Net Surplus Credit, Capital Fund Debit
                netSurplusCreditAmount += debitAmount;
                capitalFundDebitAmount += debitAmount;
              }
            }
          }
        }
      } else if (contraEntryName === "Bank Transfer") {
        // For Bank Transfer: Process normally like journal entries
        for (const item of itemDetails) {
          const ledger = ledgers.find(
            (l) => l._id.toString() === item.ledgerId.toString()
          );

          if (ledger && ledger.headOfAccountId) {
            const headOfAccountName =
              ledger.headOfAccountId.headOfAccountName.toLowerCase();
            const debitAmount = parseFloat(item.debitAmount) || 0;
            const creditAmount = parseFloat(item.creditAmount) || 0;

            // Scenario analysis based on your requirements
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
      }

      // Round to two decimals
      netSurplusDebitAmount = netSurplusDebitAmount;
      netSurplusCreditAmount = netSurplusCreditAmount;
      capitalFundDebitAmount = capitalFundDebitAmount;
      capitalFundCreditAmount = capitalFundCreditAmount;

      // Remove entries from Net Surplus/(Deficit) and Capital Fund ledgers
      // (Since we're cancelling, we remove the entries regardless of amounts)
      await removeContraEntryFromBalances(
        schoolId,
        financialYear,
        existingContra._id,
        session
      );

      // Recalculate balances for both ledgers
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
        existingContra.entryDate,
        session
      );

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
        existingContra.entryDate,
        session
      );

      // Store all ledger IDs that were affected by this contra
      const ledgerIdsToUpdate = new Set();

      // 1. Add main ledgers from item details
      const ledgerAmounts = aggregateAmountsByLedger(itemDetails);
      for (const [ledgerId] of ledgerAmounts) {
        ledgerIdsToUpdate.add(ledgerId);
      }

      // 2. Add cash account ledgers if applicable
      if (
        ["Cash Deposited", "Cash Withdrawn", "Bank Transfer", ""].includes(
          contraEntryName
        )
      ) {
        const cashAccountAmounts = aggregateCashAccountAmounts(itemDetails);
        for (const [cashAccountId] of cashAccountAmounts) {
          ledgerIdsToUpdate.add(cashAccountId);
        }
      }

      // 3. Add TDS/TCS ledger if applicable
      if (TDSorTCS && TDSTCSRateAmount > 0 && TDSorTCSLedgerId) {
        ledgerIdsToUpdate.add(TDSorTCSLedgerId.toString());
      }

      // 4. Also include Net Surplus/(Deficit) and Capital Fund if they were affected
      if (netSurplusDeficitLedger) {
        ledgerIdsToUpdate.add(netSurplusDeficitLedger._id.toString());
      }
      if (capitalFundLedger) {
        ledgerIdsToUpdate.add(capitalFundLedger._id.toString());
      }

      console.log(
        `All ledger IDs for propagation in contra cancel:`,
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
            `Error propagating changes for ledger ${ledgerId} during contra cancel:`,
            propagationError
          );
          // Don't throw here - we want to continue with other ledgers
        }
      }

      // =====End of Net Surplus/(Deficit)...Capital Fund=====
      return res.status(200).json({
        hasError: false,
        message: "Contra cancelled successfully.",
        data: existingContra,
      });
    });
  } catch (error) {
    console.error("Error cancelling Contra:", error);

    // Handle specific error types
    if (
      error.message.includes("Access denied") ||
      error.message.includes("Contra not found") ||
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
