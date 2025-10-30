import mongoose from "mongoose";
import Contra from "../../../models/Contra.js";
import ContraValidator from "../../../validators/ContraValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function generateContraVoucherNumber(schoolId, academicYear) {
  // Find the highest existing voucher number
  const lastEntry = await Contra.findOne(
    {
      schoolId,
      academicYear,
      status: "Posted",
      contraVoucherNumber: { $exists: true, $ne: null },
    },
    { contraVoucherNumber: 1 },
    { sort: { contraVoucherNumber: -1 } }
  );

  let nextNumber = 1;

  if (lastEntry && lastEntry.contraVoucherNumber) {
    const matches = lastEntry.contraVoucherNumber.match(/\/(\d+)$/);
    if (matches && matches[1]) {
      nextNumber = parseInt(matches[1]) + 1;
    }
  }

  return `CVN/${academicYear}/${nextNumber}`;
}

async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  session // ADDED: session parameter
) {
  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session); // ADDED: session

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
  }).session(session); // ADDED: session

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
  session // ADDED: session parameter
) {
  debitAmount = toTwoDecimals(debitAmount);
  creditAmount = toTwoDecimals(creditAmount);

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate,
      session // ADDED: session
    );

  // Determine effective opening balance
  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) <= new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  let effectiveOpeningBalance = toTwoDecimals(openingBalance);

  if (previousBalanceDetails.length > 0) {
    effectiveOpeningBalance = toTwoDecimals(
      previousBalanceDetails[0].closingBalance
    );
  }

  // Calculate closing balance
  let closingBalance;
  if (balanceType === "Debit") {
    closingBalance = toTwoDecimals(
      effectiveOpeningBalance + debitAmount - creditAmount
    );
  } else {
    closingBalance = toTwoDecimals(
      effectiveOpeningBalance + debitAmount - creditAmount
    );
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

  await record.save({ session }); // ADDED: session
  return record;
}

async function recalculateLedgerBalances(
  schoolId,
  academicYear,
  ledgerId,
  session // ADDED: session parameter
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session); // ADDED: session

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session); // ADDED: session

  const balanceType = ledger?.balanceType || "Debit";

  // Sort all entries by date, then by _id for consistent same-day order
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  // Find the initial opening balance (from ledger or first entry)
  let currentBalance = toTwoDecimals(record.balanceDetails[0].openingBalance);

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = detail.openingBalance;
    } else {
      // Update opening balance to previous closing balance
      detail.openingBalance = toTwoDecimals(
        record.balanceDetails[i - 1].closingBalance
      );
      currentBalance = detail.openingBalance;
    }

    // Calculate new closing balance
    if (balanceType === "Debit") {
      detail.closingBalance = toTwoDecimals(
        currentBalance + detail.debit - detail.credit
      );
    } else {
      detail.closingBalance = toTwoDecimals(
        currentBalance + detail.debit - detail.credit
      );
    }

    currentBalance = detail.closingBalance;
  }

  await record.save({ session }); // ADDED: session
}

async function recalculateAllBalancesAfterDate(
  schoolId,
  academicYear,
  ledgerId,
  date,
  session // ADDED: session parameter
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session); // ADDED: session

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
    }).session(session); // ADDED: session

    const balanceType = ledger?.balanceType || "Debit";

    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save({ session }); // ADDED: session
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

export async function create(req, res) {
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

    const { error } = ContraValidator.ContraValidator.validate(req.body);
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
      contraEntryName,
      dateOfCashDepositedWithdrawlDate,
      narration,
      chequeNumber,
      itemDetails,
      TDSorTCS,
      TDSTCSRateAmount,
      status,
      academicYear,
    } = req.body;

    let contraVoucherNumber = null;

    // Only generate voucher number if status is "Posted" from the beginning
    if (status === "Posted") {
      contraVoucherNumber = await generateContraVoucherNumber(
        schoolId,
        academicYear
      );
    }

    const { chequeImageForContra } = req.files || {};

    let chequeImageForContraFullPath = "";
    if (chequeImageForContra?.[0]) {
      const basePath = chequeImageForContra[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/chequeImageForContra"
        : "/Documents/FinanceModule/chequeImageForContra";
      chequeImageForContraFullPath = `${basePath}/${chequeImageForContra[0].filename}`;
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

    const totalAmountOfDebit =
      subTotalOfDebit + (toTwoDecimals(TDSTCSRateAmount) || 0);
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
            "ledgerIdOfCashAccount is required for Cash Deposited or Cash Withdrawn entries.",
        });
      }
    }

    let TDSorTCSLedgerId = null;

    if (TDSorTCS && TDSTCSRateAmount > 0) {
      // Search for "TDS on Receipts" or "TCS on Receipts" ledger
      const ledgerNameToFind =
        TDSorTCS === "TDS" ? "TDS on Cash Withdrawn/Deposited" : "TCS";

      // Find the ledger with exact name match
      let tdsTcsLedgerToUpdate = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: { $regex: new RegExp(`^${ledgerNameToFind}$`, "i") },
      }).session(session); // ADDED: session

      if (!tdsTcsLedgerToUpdate) {
        throw new Error(
          `${ledgerNameToFind} Ledger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      TDSorTCSLedgerId = tdsTcsLedgerToUpdate._id.toString();
    }

    const newContra = new Contra({
      schoolId,
      contraVoucherNumber,
      contraEntryName,
      entryDate,
      dateOfCashDepositedWithdrawlDate,
      narration,
      chequeNumber,
      itemDetails: updatedItemDetails,
      subTotalOfCredit: subTotalOfCredit,
      subTotalOfDebit: subTotalOfDebit,
      TDSorTCS,
      TDSTCSRateAmount,
      totalAmountOfDebit,
      totalAmountOfCredit,
      chequeImageForContra: chequeImageForContraFullPath,
      status,
      academicYear,
      TDSorTCSLedgerId,
    });

    await newContra.save({ session });

    // Store all ledger IDs that need to be updated
    const ledgerIdsToUpdate = new Set();

    // Process based on contra entry type
    if (contraEntryName === "Cash Deposited") {
      const mainLedgerAmounts = aggregateAmountsByLedger(updatedItemDetails);
      for (const [ledgerId, amounts] of mainLedgerAmounts) {
        // Debit the main ledger (aggregated)
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          newContra.entryDate,
          newContra._id,
          amounts.debitAmount, // Aggregated debit
          0, // No credit for main ledger in Cash Deposited
          session // ADDED: session parameter
        );
        ledgerIdsToUpdate.add(ledgerId);
      }

      const cashAccountAmounts =
        aggregateCashAccountAmounts(updatedItemDetails);
      for (const [cashAccountId, amounts] of cashAccountAmounts) {
        // Credit the cash account (aggregated)
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          cashAccountId,
          newContra.entryDate,
          newContra._id,
          0, // No debit for cash account in Cash Deposited
          amounts.creditAmount, // Aggregated credit
          session // ADDED: session parameter
        );
        ledgerIdsToUpdate.add(cashAccountId);
      }
    } else if (contraEntryName === "Cash Withdrawn") {
      // For Cash Withdrawn: Credit main ledger, Debit cash account
      const mainLedgerAmounts = aggregateAmountsByLedger(updatedItemDetails);
      for (const [ledgerId, amounts] of mainLedgerAmounts) {
        // Credit the main ledger (aggregated)
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          newContra.entryDate,
          newContra._id,
          0, // No debit for main ledger in Cash Withdrawn
          amounts.creditAmount, // Aggregated credit
          session // ADDED: session parameter
        );
        ledgerIdsToUpdate.add(ledgerId);
      }

      // Aggregate cash account amounts
      const cashAccountAmounts =
        aggregateCashAccountAmounts(updatedItemDetails);
      for (const [cashAccountId, amounts] of cashAccountAmounts) {
        // Debit the cash account (aggregated)
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          cashAccountId,
          newContra.entryDate,
          newContra._id,
          amounts.debitAmount, // Aggregated debit
          0, // No credit for cash account in Cash Withdrawn
          session // ADDED: session parameter
        );
        ledgerIdsToUpdate.add(cashAccountId);
      }
    } else if (contraEntryName === "Bank Transfer") {
      // For Bank Transfer: Process each item normally
      const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);
      for (const [ledgerId, amounts] of ledgerAmounts) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          newContra.entryDate,
          newContra._id,
          amounts.debitAmount, // Aggregated debit
          amounts.creditAmount, // Aggregated credit
          session // ADDED: session parameter
        );
        ledgerIdsToUpdate.add(ledgerId.toString());
      }
    }

    if (TDSorTCS && TDSTCSRateAmount > 0 && TDSorTCSLedgerId) {
      if (TDSorTCS === "TDS") {
        // For TDS: Debit the TDS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSorTCSLedgerId,
          entryDate,
          newContra._id,
          Number(TDSTCSRateAmount),
          0,
          session // ADDED: session parameter
        );
      } else if (TDSorTCS === "TCS") {
        // For TCS: Credit the TCS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSorTCSLedgerId,
          entryDate,
          newContra._id,
          0,
          Number(TDSTCSRateAmount),
          session // ADDED: session parameter
        );
      }

      ledgerIdsToUpdate.add(TDSorTCSLedgerId);
    }

    // Recalculate all ledgers that were updated
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        ledgerId,
        session // ADDED: session parameter
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        session // ADDED: session parameter
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

    // Update Net Surplus/(Deficit) ledger
    if (netSurplusDebitAmount > 0 || netSurplusCreditAmount > 0) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        newContra._id,
        netSurplusDebitAmount,
        netSurplusCreditAmount,
        session // ADDED: session parameter
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        session // ADDED: session parameter
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        session // ADDED: session parameter
      );

      ledgerIdsToUpdate.add(netSurplusDeficitLedger._id.toString());
    }

    // Update Capital Fund ledger
    if (capitalFundDebitAmount > 0 || capitalFundCreditAmount > 0) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        newContra._id,
        capitalFundDebitAmount,
        capitalFundCreditAmount,
        session // ADDED: session parameter
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        session // ADDED: session parameter
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        session // ADDED: session parameter
      );

      ledgerIdsToUpdate.add(capitalFundLedger._id.toString());
    }

    // =====End of Net Surplus/(Deficit)...Capital Fund=====

    // ========= PROPAGATE CHANGES TO SUBSEQUENT ACADEMIC YEARS =========
    // This is the key addition that was missing

    console.log(
      `All ledger IDs for propagation in contra create:`,
      Array.from(ledgerIdsToUpdate)
    );

    // Propagate changes for each affected ledger
    for (const ledgerId of ledgerIdsToUpdate) {
      try {
        await propagateBalanceChangeToNextYear(
          schoolId,
          academicYear,
          ledgerId,
          session
        );
      } catch (propagationError) {
        console.error(
          `Error propagating changes for ledger ${ledgerId} during contra create:`,
          propagationError
        );
        // Don't throw here - we want to continue with other ledgers
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      hasError: false,
      message: "Contra created successfully!",
      data: newContra,
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
        message: `Duplicate entry for ${field}. Contra already exists.`,
      });
    }

    console.error("Error creating Contra:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
