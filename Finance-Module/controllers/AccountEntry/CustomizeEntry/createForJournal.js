import mongoose from "mongoose";
import Journal from "../../../models/Journal.js";
import JournalValidator from "../../../validators/JournalValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function generateJournalVoucherNumber(schoolId, academicYear) {
  const count = await Journal.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `JVN/${academicYear}/${nextNumber}`;
}

async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate
) {
  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  });

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
  journalId,
  debitAmount = 0,
  creditAmount = 0
) {
  debitAmount = toTwoDecimals(debitAmount);
  creditAmount = toTwoDecimals(creditAmount);

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate
    );

  // --- FIX: Determine effective opening balance ---
  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) <= new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  let effectiveOpeningBalance = toTwoDecimals(openingBalance);

  if (previousBalanceDetails.length > 0) {
    effectiveOpeningBalance = toTwoDecimals(
      previousBalanceDetails[0].closingBalance
    );
  }

  // --- Calculate closing balance ---
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

  // --- Check if exact same entry already exists ---
  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) =>
      new Date(detail.entryDate).getTime() === new Date(entryDate).getTime() &&
      detail.entryId?.toString() === journalId.toString()
  );

  if (existingEntryIndex !== -1) {
    record.balanceDetails[existingEntryIndex] = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: journalId,
    };
  } else {
    const newBalanceDetail = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: journalId,
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

  await record.save();
  return record;
}

async function recalculateLedgerBalances(schoolId, academicYear, ledgerId) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  });

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  });

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

  await record.save();
}

async function recalculateAllBalancesAfterDate(
  schoolId,
  academicYear,
  ledgerId,
  date
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  });

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
    });

    const balanceType = ledger?.balanceType || "Debit";

    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save();
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

// ========

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

    const { error } = JournalValidator.CustomizeEntryJournalValidator.validate(
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

    const {
      entryDate,
      documentDate,
      narration,
      itemDetails,
      status,
      academicYear,
      customizeEntry,
    } = req.body;

    const { documentImage } = req.files || {};

    const JournalVoucherNumber = await generateJournalVoucherNumber(
      schoolId,
      academicYear
    );

    const documentImagePath = documentImage?.[0]?.mimetype.startsWith("image/")
      ? "/Images/FinanceModule/DocumentImageForJournal"
      : "/Documents/FinanceModule/DocumentImageForJournal";

    const documentImageFullPath = documentImage?.[0]
      ? `${documentImagePath}/${documentImage[0].filename}`
      : null;

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

    const newJournal = new Journal({
      schoolId,
      journalVoucherNumber: JournalVoucherNumber,
      entryDate,
      documentDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalOfCredit: subTotalOfCredit,
      subTotalOfDebit: subTotalOfDebit,
      totalAmountOfDebit,
      totalAmountOfCredit,
      documentImage: documentImageFullPath,
      status,
      academicYear,
      customizeEntry,
    });

    await newJournal.save({ session });

    // Store all ledger IDs that need to be updated
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers - Aggregate amounts by ledgerId
    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);

    for (const [ledgerId, amounts] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        newJournal._id,
        amounts.debitAmount,
        amounts.creditAmount
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // Recalculate all ledgers that were updated
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(schoolId, academicYear, ledgerId);

      // Also recalculate all entries after this date to handle backdated entries
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate
      );
    }

    // Get all unique ledger IDs from itemDetails
    const uniqueLedgerIds = [
      ...new Set(updatedItemDetails.map((item) => item.ledgerId)),
    ];

    // Find ledgers with their Head of Account information
    const ledgers = await Ledger.find({
      _id: { $in: uniqueLedgerIds },
    }).populate("headOfAccountId");

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
        const debitAmount = parseFloat(item.debitAmount) || 0;
        const creditAmount = parseFloat(item.creditAmount) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          incomeBalance += debitAmount - creditAmount;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          expensesBalance += debitAmount - creditAmount;
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

    const existingEntryIndex = totalNetRecord.balanceDetails.findIndex(
      (detail) => detail.entryId?.toString() === newJournal._id.toString()
    );

    if (existingEntryIndex !== -1) {
      totalNetRecord.balanceDetails[existingEntryIndex].incomeBalance =
        incomeBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].expensesBalance =
        expensesBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].totalBalance =
        totalBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].entryDate = entryDate;
    } else {
      totalNetRecord.balanceDetails.push({
        entryDate,
        entryId: newJournal._id,
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

    // Analyze each journal item to determine the correct posting
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
        newJournal._id,
        netSurplusDebitAmount,
        netSurplusCreditAmount
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate
      );
    }

    // Update Capital Fund ledger
    if (capitalFundDebitAmount > 0 || capitalFundCreditAmount > 0) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        newJournal._id,
        capitalFundDebitAmount,
        capitalFundCreditAmount
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        capitalFundLedger._id
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate
      );
    }

    // =====End of Net Surplus/(Deficit)...Capital Fund=====

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      hasError: false,
      message: "Journal created successfully!",
      data: newJournal,
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
        message: `Duplicate entry for ${field}. Journal already exists.`,
      });
    }

    console.error("Error creating Journal:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
