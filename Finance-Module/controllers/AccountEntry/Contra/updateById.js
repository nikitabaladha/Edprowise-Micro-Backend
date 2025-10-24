import mongoose from "mongoose";
import Contra from "../../../models/Contra.js";
import ContraValidator from "../../../validators/ContraValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

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

  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) < new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  if (previousBalanceDetails.length > 0) {
    openingBalance = toTwoDecimals(previousBalanceDetails[0].closingBalance);
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
  debitAmount = toTwoDecimals(Number(debitAmount));
  creditAmount = toTwoDecimals(Number(creditAmount));

  const { record, openingBalance } = await getOrCreateOpeningBalanceRecord(
    schoolId,
    academicYear,
    ledgerId,
    entryDate,
    session
  );

  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) => detail.entryId?.toString() === contraId.toString()
  );

  let entrySequence;

  if (existingEntryIndex !== -1) {
    const existing = record.balanceDetails[existingEntryIndex];
    entrySequence = existing.entrySequence;
    existing.debit = debitAmount;
    existing.credit = creditAmount;
    existing.entryDate = entryDate;
  } else {
    const sameDayEntries = record.balanceDetails.filter(
      (d) =>
        new Date(d.entryDate).toISOString() ===
        new Date(entryDate).toISOString()
    );
    entrySequence =
      sameDayEntries.length > 0
        ? Math.max(...sameDayEntries.map((d) => d.entrySequence || 0)) + 1
        : 1;

    record.balanceDetails.push({
      entryDate,
      entrySequence,
      debit: debitAmount,
      credit: creditAmount,
      entryId: contraId,
    });
  }

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    if ((a.entrySequence || 0) !== (b.entrySequence || 0)) {
      return (a.entrySequence || 0) - (b.entrySequence || 0);
    }
    return a._id.toString().localeCompare(b._id.toString());
  });

  record.balanceDetails.forEach((detail, index) => {
    if (index === 0) {
      detail.openingBalance = openingBalance;
    } else {
      detail.openingBalance = record.balanceDetails[index - 1].closingBalance;
    }
    detail.closingBalance =
      detail.openingBalance + (detail.debit || 0) - (detail.credit || 0);
  });

  await record.save({ session });
  return record;
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

function aggregateCashAccountAmounts(itemDetails) {
  const cashAccountMap = new Map();

  itemDetails.forEach((item) => {
    if (item.ledgerIdOfCashAccount) {
      const cashAccountId = item.ledgerIdOfCashAccount.toString();
      const debitAmount = toTwoDecimals(item.debitAmount) || 0;
      const creditAmount = toTwoDecimals(item.creditAmount) || 0;

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

async function removeContraEntryFromLedger(
  schoolId,
  academicYear,
  contraId,
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
    (detail) => detail.entryId?.toString() !== contraId.toString()
  );

  if (record.balanceDetails.length === originalLength) return; // nothing removed

  // Sort the remaining entries
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    if ((a.entrySequence || 0) !== (b.entrySequence || 0)) {
      return (a.entrySequence || 0) - (b.entrySequence || 0);
    }
    return a._id.toString().localeCompare(b._id.toString());
  });

  // Recalculate opening and closing balances
  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    if (i === 0) {
      // First entry uses ledger opening balance
      const ledger = await Ledger.findById(ledgerId).session(session);
      detail.openingBalance = ledger?.openingBalance || 0;
    } else {
      detail.openingBalance = record.balanceDetails[i - 1].closingBalance;
    }
    detail.closingBalance =
      detail.openingBalance + (detail.debit || 0) - (detail.credit || 0);
  }

  await record.save({ session });
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

export const updateById = async (req, res) => {
  // First, do all validations BEFORE starting the transaction
  const { schoolId } = req.user;
  if (!schoolId) {
    return res
      .status(401)
      .json({ hasError: true, message: "Unauthorized request." });
  }

  const { id, academicYear } = req.params;
  const {
    entryDate,
    contraEntryName,
    dateOfCashDepositedWithdrawlDate,
    narration,
    chequeNumber,
    itemDetails,
    TDSorTCS,
    TDSTCSRateAmount,
    status,
  } = req.body;

  const { error } = ContraValidator.ContraValidatorUpdate.validate(req.body);
  if (error) {
    const errorMessages = error.details.map((err) => err.message).join(", ");
    return res.status(400).json({ hasError: true, message: errorMessages });
  }

  // Validate debit/credit equality BEFORE transaction
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

  const tdsTcsAmount = TDSorTCS ? toTwoDecimals(TDSTCSRateAmount) || 0 : 0;

  const totalAmountOfDebit =
    subTotalOfDebit + (toTwoDecimals(TDSTCSRateAmount) || 0);
  const totalAmountOfCredit = subTotalOfCredit;

  if (totalAmountOfDebit !== totalAmountOfCredit) {
    return res.status(400).json({
      hasError: true,
      message: "Total Debit and Credit amounts must be equal.",
    });
  }

  // Validate cash account requirement for Cash Deposited/Withdrawn BEFORE transaction
  if (["Cash Deposited", "Cash Withdrawn"].includes(contraEntryName)) {
    const missingCashAccount = updatedItemDetails.some(
      (item) => !item.ledgerIdOfCashAccount
    );
    if (missingCashAccount) {
      return res.status(400).json({
        hasError: true,
        message:
          "LedgerId Of CashAccount is required for Cash Deposited or Cash Withdrawn entries.",
      });
    }
  }

  // NOW start the transaction after all validations pass
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingContra = await Contra.findOne({
      _id: id,
      schoolId,
      academicYear,
    }).session(session);
    if (!existingContra) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ hasError: true, message: "Contra not found." });
    }

    // --- Track old ledger/cash/TDS ids ---
    const oldLedgerIds = existingContra.itemDetails.map((item) =>
      item.ledgerId?.toString()
    );
    const oldCashAccountIds = existingContra.itemDetails
      .filter((item) => item.ledgerIdOfCashAccount)
      .map((item) => item.ledgerIdOfCashAccount.toString());
    const oldTDSorTCSId = existingContra.TDSorTCSLedgerId?.toString();

    // Step A: Reset old debit/credit
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

    // Step B: Update contra document
    existingContra.entryDate = entryDate || existingContra.entryDate;
    existingContra.contraEntryName =
      contraEntryName || existingContra.contraEntryName;
    existingContra.dateOfCashDepositedWithdrawlDate =
      dateOfCashDepositedWithdrawlDate ||
      existingContra.dateOfCashDepositedWithdrawlDate;
    existingContra.narration = narration || existingContra.narration;
    existingContra.chequeNumber = chequeNumber || existingContra.chequeNumber;

    existingContra.itemDetails = updatedItemDetails;

    existingContra.subTotalOfDebit = subTotalOfDebit;
    existingContra.subTotalOfCredit = subTotalOfCredit;

    existingContra.TDSorTCS = TDSorTCS || "";
    existingContra.TDSTCSRateAmount = tdsTcsAmount;

    // Fix: Find and set TDS/TCS ledger ID when TDS/TCS is selected
    if (TDSorTCS && tdsTcsAmount > 0) {
      // Search for the appropriate TDS/TCS ledger
      const ledgerNameToFind =
        TDSorTCS === "TDS" ? "TDS on Cash Withdrawn/Deposited" : "TCS";

      // Find the ledger with exact name match
      let tdsTcsLedgerToUpdate = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: { $regex: new RegExp(`^${ledgerNameToFind}$`, "i") },
      }).session(session);

      if (!tdsTcsLedgerToUpdate) {
        throw new Error(
          `${ledgerNameToFind} Ledger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      existingContra.TDSorTCSLedgerId = tdsTcsLedgerToUpdate._id.toString();
    } else {
      existingContra.TDSorTCSLedgerId = null;
    }

    existingContra.totalAmountOfDebit = totalAmountOfDebit;
    existingContra.totalAmountOfCredit = totalAmountOfCredit;
    existingContra.status = status || existingContra.status;

    await existingContra.save({ session });

    // --- Step C: Apply new balances ---
    const ledgerMap = aggregateAmountsByLedger(existingContra.itemDetails);
    const cashAccountMap = aggregateCashAccountAmounts(
      existingContra.itemDetails
    );

    // Remove old entries if ledger/cash/TDS changed or removed
    for (const oldLedgerId of oldLedgerIds) {
      if (!ledgerMap.has(oldLedgerId))
        await removeContraEntryFromLedger(
          schoolId,
          academicYear,
          id,
          oldLedgerId,
          session
        );
    }
    for (const oldCashId of oldCashAccountIds) {
      if (!cashAccountMap.has(oldCashId))
        await removeContraEntryFromLedger(
          schoolId,
          academicYear,
          id,
          oldCashId,
          session
        );
    }
    if (
      oldTDSorTCSId &&
      (!TDSorTCS ||
        oldTDSorTCSId !== existingContra.TDSorTCSLedgerId?.toString())
    ) {
      await removeContraEntryFromLedger(
        schoolId,
        academicYear,
        id,
        oldTDSorTCSId,
        session
      );
    }

    // Apply updated balances
    if (contraEntryName === "Cash Deposited") {
      for (const [ledgerId, amounts] of ledgerMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          entryDate,
          id,
          amounts.debitAmount,
          0,
          session
        );
      }
      for (const [cashAccountId, amounts] of cashAccountMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          cashAccountId,
          entryDate,
          id,
          0,
          amounts.creditAmount,
          session
        );
      }
    } else if (contraEntryName === "Cash Withdrawn") {
      for (const [ledgerId, amounts] of ledgerMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          entryDate,
          id,
          0,
          amounts.creditAmount,
          session
        );
      }
      for (const [cashAccountId, amounts] of cashAccountMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          cashAccountId,
          entryDate,
          id,
          amounts.debitAmount,
          0,
          session
        );
      }
    } else if (contraEntryName === "Bank Transfer") {
      for (const [ledgerId, amounts] of ledgerMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          entryDate,
          id,
          amounts.debitAmount,
          amounts.creditAmount,
          session
        );
      }
      for (const [cashAccountId, amounts] of cashAccountMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          cashAccountId,
          entryDate,
          id,
          amounts.debitAmount,
          amounts.creditAmount,
          session
        );
      }
    }

    // Handle TDS/TCS ledger
    if (TDSorTCS && existingContra.TDSorTCSLedgerId) {
      const TDSLedgerId = existingContra.TDSorTCSLedgerId.toString();
      if (TDSorTCS === "TDS") {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSLedgerId,
          entryDate,
          id,
          parseFloat(TDSTCSRateAmount) || 0,
          0,
          session
        );
      } else if (TDSorTCS === "TCS") {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSLedgerId,
          entryDate,
          id,
          0,
          parseFloat(TDSTCSRateAmount) || 0,
          session
        );
      }
    }

    const allLedgerIds = new Set([
      ...Array.from(ledgerMap.keys()),
      ...Array.from(cashAccountMap.keys()),
      ...(existingContra.TDSorTCSLedgerId
        ? [existingContra.TDSorTCSLedgerId.toString()]
        : []),
    ]);

    for (const ledgerId of allLedgerIds) {
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        session
      );
    }

    // =====Start Of Net Surplus/(Deficit)...Capital Fund=====

    // Get all unique ledger IDs from itemDetails (both ledgerId and ledgerIdOfCashAccount)
    const uniqueLedgerIds = [
      ...new Set(
        updatedItemDetails
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

    // Process based on contra entry type
    if (contraEntryName === "Cash Deposited") {
      // For Cash Deposited: ledgerId is debited, ledgerIdOfCashAccount is credited
      for (const item of updatedItemDetails) {
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
      for (const item of updatedItemDetails) {
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
      for (const item of updatedItemDetails) {
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
      await removeContraEntryFromLedger(
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
        id,
        netSurplusDebitAmount,
        netSurplusCreditAmount,
        session
      );
    }

    // Handle Capital Fund ledger
    if (!hasCapitalFundEntries) {
      // Remove the entry completely if no amounts
      await removeContraEntryFromLedger(
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
        id,
        capitalFundDebitAmount,
        capitalFundCreditAmount,
        session
      );
    }

    // Add to allLedgerIds set for recalculation
    allLedgerIds.add(netSurplusDeficitLedger._id.toString());
    allLedgerIds.add(capitalFundLedger._id.toString());

    // =====End of Net Surplus/(Deficit)...Capital Fund=====

    // --- Step E: Propagate changes to subsequent academic years ---
    const affectedLedgerIds = new Set([...allLedgerIds]);

    // Also include Net Surplus/(Deficit) and Capital Fund if they were affected
    if (netSurplusDeficitLedger) {
      affectedLedgerIds.add(netSurplusDeficitLedger._id.toString());
    }
    if (capitalFundLedger) {
      affectedLedgerIds.add(capitalFundLedger._id.toString());
    }

    // FIXED: Include ALL ledgers that need propagation
    const allLedgersToPropagate = new Set([...affectedLedgerIds]);

    // FIXED: CRITICAL - Also include ALL old item ledgers, cash accounts, and TDS/TCS
    for (const oldLedgerId of oldLedgerIds) {
      if (oldLedgerId) {
        allLedgersToPropagate.add(oldLedgerId);
      }
    }

    for (const oldCashId of oldCashAccountIds) {
      if (oldCashId) {
        allLedgersToPropagate.add(oldCashId);
      }
    }

    if (oldTDSorTCSId) {
      allLedgersToPropagate.add(oldTDSorTCSId);
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

    res.status(200).json({
      hasError: false,
      message: "Contra updated successfully!",
      data: existingContra,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating contra entry:", error);
    res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
};

export default updateById;
