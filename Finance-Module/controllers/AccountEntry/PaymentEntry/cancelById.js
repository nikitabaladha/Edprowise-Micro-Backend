import mongoose from "mongoose";
import PaymentEntry from "../../../models/PaymentEntry.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function removePaymentEntryFromLedger(
  schoolId,
  financialYear,
  paymentEntryId,
  ledgerId,
  session
) {
  // Find the record
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    financialYear,
    ledgerId,
  }).session(session);

  if (!record) return;

  // Remove the entry from balanceDetails
  const originalLength = record.balanceDetails.length;
  record.balanceDetails = record.balanceDetails.filter(
    (detail) => detail.entryId?.toString() !== paymentEntryId.toString()
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

  // Recalculate opening and closing balances - FIXED: Use toTwoDecimals
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

async function recalculateLedgerBalances(
  schoolId,
  financialYear,
  ledgerId,
  session
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    financialYear,
    ledgerId,
  }).session(session);

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    financialYear,
    _id: ledgerId,
  }).session(session);

  const balanceType = ledger?.balanceType || "Debit";

  // Sort by date and entrySequence
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Ensure sequences are continuous and properly ordered
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

  // Now recalculate balances - FIXED: Use toTwoDecimals
  let currentBalance = toTwoDecimals(record.balanceDetails[0].openingBalance);

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = toTwoDecimals(detail.openingBalance);
    } else {
      const previousDetail = record.balanceDetails[i - 1];
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
  financialYear,
  ledgerId,
  date,
  session
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    financialYear,
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
  session.startTransaction();

  try {
    const schoolId = req.user?.schoolId;
    const { id, financialYear } = req.params;

    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    // Find the payment entry with all details
    const existingPayment = await PaymentEntry.findOne({
      _id: id,
      schoolId,
      financialYear,
    }).session(session);

    if (!existingPayment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "Payment entry not found.",
      });
    }

    // Store all ledger IDs that were affected by this payment
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers (from itemDetails)
    const itemLedgerIds = existingPayment.itemDetails
      .map((item) => item.ledgerId?.toString())
      .filter((id) => id);

    itemLedgerIds.forEach((id) => ledgerIdsToUpdate.add(id));

    // 2. Payment Mode Ledger
    if (existingPayment.ledgerIdWithPaymentMode) {
      ledgerIdsToUpdate.add(existingPayment.ledgerIdWithPaymentMode.toString());
    }

    // 3. TDS/TCS Ledger (if applicable)
    if (existingPayment.TDSorTCSLedgerId) {
      ledgerIdsToUpdate.add(existingPayment.TDSorTCSLedgerId.toString());
    }

    // --- Step A: Remove payment entry from all affected ledgers ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await removePaymentEntryFromLedger(
        schoolId,
        financialYear,
        existingPayment._id,
        ledgerId,
        session
      );
    }

    // --- Step B: Update payment status to "Cancelled" ---
    existingPayment.status = "Cancelled";
    await existingPayment.save({ session });

    // --- Step C: Recalculate all affected ledgers ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(
        schoolId,
        financialYear,
        ledgerId,
        session
      );

      // Also recalculate balances after the entry date to handle sequencing
      await recalculateAllBalancesAfterDate(
        schoolId,
        financialYear,
        ledgerId,
        existingPayment.entryDate,
        session
      );
    }

    // ========== NEW CODE: Remove data from TotalNetdeficitNetSurplus table ==========

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
        console.log(
          `Removed payment entry ${id} from TotalNetdeficitNetSurplus`
        );
      }
    }

    // ========== Handle Net Surplus/(Deficit) and Capital Fund Ledgers ==========

    // Get all unique ledger IDs from itemDetails
    const uniqueLedgerIds = [
      ...new Set(existingPayment.itemDetails.map((item) => item.ledgerId)),
    ];

    // Find ledgers with their Head of Account information
    const ledgers = await Ledger.find({
      _id: { $in: uniqueLedgerIds },
    })
      .populate("headOfAccountId")
      .session(session);

    // Calculate income and expenses totals (same logic as create/update)
    let incomeTotal = 0;
    let expensesTotal = 0;
    let hasIncome = false;
    let hasExpenses = false;

    for (const item of existingPayment.itemDetails) {
      const ledger = ledgers.find(
        (l) => l._id.toString() === item.ledgerId.toString()
      );

      if (ledger && ledger.headOfAccountId) {
        const headOfAccountName = ledger.headOfAccountId.headOfAccountName;
        const amountAfterGST = parseFloat(item.amountAfterGST) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          hasIncome = true;
          incomeTotal += amountAfterGST;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          hasExpenses = true;
          expensesTotal += amountAfterGST;
        }
      }
    }

    incomeTotal = incomeTotal;
    expensesTotal = expensesTotal;

    // ========= Net Surplus/(Deficit) Ledger ===========
    const netSurplusDeficitLedger = await Ledger.findOne({
      schoolId,
      financialYear,
      ledgerName: "Net Surplus/(Deficit)",
    }).session(session);

    if (netSurplusDeficitLedger) {
      // Remove the entry from Net Surplus/(Deficit) ledger
      await removePaymentEntryFromLedger(
        schoolId,
        financialYear,
        existingPayment._id,
        netSurplusDeficitLedger._id,
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
        existingPayment.entryDate,
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
      await removePaymentEntryFromLedger(
        schoolId,
        financialYear,
        existingPayment._id,
        capitalFundLedger._id,
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
        existingPayment.entryDate,
        session
      );
    }

    // ========= NEW: Propagate changes to subsequent academic years =========

    // Include all affected ledgers for propagation
    const allLedgersToPropagate = new Set([...ledgerIdsToUpdate]);

    // Also include Net Surplus/(Deficit) and Capital Fund if they were affected
    if (netSurplusDeficitLedger) {
      allLedgersToPropagate.add(netSurplusDeficitLedger._id.toString());
    }
    if (capitalFundLedger) {
      allLedgersToPropagate.add(capitalFundLedger._id.toString());
    }

    console.log(
      `All ledger IDs for propagation in cancel:`,
      Array.from(allLedgersToPropagate)
    );

    // Propagate changes for each affected ledger
    for (const ledgerId of allLedgersToPropagate) {
      try {
        await propagateBalanceChangeToNextYear(
          schoolId,
          financialYear,
          ledgerId,
          session
        );
      } catch (propagationError) {
        console.error(
          `Error propagating changes for ledger ${ledgerId} during cancel:`,
          propagationError
        );
        // Don't throw here - we want to continue with other ledgers
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Payment entry cancelled successfully!",
      data: existingPayment,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error cancelling Payment Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default cancelById;
