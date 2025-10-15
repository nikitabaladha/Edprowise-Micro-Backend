import mongoose from "mongoose";
import moment from "moment";
import Receipt from "../../../models/Receipt.js";
import ReceiptValidator from "../../../validators/ReceiptValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function generateReceiptVoucherNumber(schoolId, academicYear) {
  const count = await Receipt.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `RVN/${academicYear}/${nextNumber}`;
}

async function generateTransactionNumber() {
  const now = moment();
  const dateTimeStr = now.format("DDMMYYYYHHmmss");
  let baseTransactionNumber = `TRA-${dateTimeStr}`;
  let transactionNumber = baseTransactionNumber;
  let counter = 1;

  while (await Receipt.exists({ transactionNumber })) {
    const suffix = String(counter).padStart(2, "0");
    transactionNumber = `${baseTransactionNumber}${suffix}`;
    counter++;
  }

  return transactionNumber;
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
  receiptId,
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
      detail.entryId?.toString() === receiptId.toString()
  );

  if (existingEntryIndex !== -1) {
    record.balanceDetails[existingEntryIndex] = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: receiptId, // Store Receipt _id as entryId
    };
  } else {
    const newBalanceDetail = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: receiptId, // Store Receipt _id as entryId
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

// NEW FUNCTION: Recalculate all balances for a ledger after a specific date
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
    const amount = toTwoDecimals(item.amount) || 0;

    if (ledgerMap.has(ledgerId)) {
      ledgerMap.set(ledgerId, ledgerMap.get(ledgerId) + amount);
    } else {
      ledgerMap.set(ledgerId, amount);
    }
  });

  return ledgerMap;
}

async function create(req, res) {
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

    const { error } = ReceiptValidator.ReceiptValidator.validate(req.body);
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
      receiptDate,
      narration,
      paymentMode,
      chequeNumber,
      itemDetails,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      status,
      TDSTCSRateWithAmount,
      ledgerIdWithPaymentMode,
      academicYear,
      totalAmount,
    } = req.body;

    const receiptVoucherNumber = await generateReceiptVoucherNumber(
      schoolId,
      academicYear
    );

    const { receiptImage, chequeImageForReceipt } = req.files || {};

    let receiptImageFullPath = null;
    if (receiptImage?.[0]) {
      const receiptImagePath = receiptImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/ReceiptImage"
        : "/Documents/FinanceModule/ReceiptImage";

      receiptImageFullPath = `${receiptImagePath}/${receiptImage[0].filename}`;
    }

    let chequeImageForReceiptFullPath = null;
    if (chequeImageForReceipt?.[0]) {
      const chequeImageForReceiptPath =
        chequeImageForReceipt[0].mimetype.startsWith("image/")
          ? "/Images/FinanceModule/chequeImageForReceipt"
          : "/Documents/FinanceModule/chequeImageForReceipt";

      chequeImageForReceiptFullPath = `${chequeImageForReceiptPath}/${chequeImageForReceipt[0].filename}`;
    }

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amount: parseFloat(item.amount) || 0,
    }));

    const subTotalAmount = toTwoDecimals(
      updatedItemDetails.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0
      )
    );

    const transactionNumber =
      paymentMode === "Online" ? await generateTransactionNumber() : null;

    let TDSorTCSLedgerId = null;

    if (TDSorTCS && TDSTCSRateWithAmount > 0) {
      // Search for "TDS on Receipts" or "TCS on Receipts" ledger
      const ledgerNameToFind =
        TDSorTCS === "TDS" ? "TDS on Receipts" : "TCS on Receipts";

      // Find the ledger with exact name match
      let tdsTcsLedgerToUpdate = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: { $regex: new RegExp(`^${ledgerNameToFind}$`, "i") },
      });

      if (!tdsTcsLedgerToUpdate) {
        throw new Error(
          `${ledgerNameToFind} Ledger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      TDSorTCSLedgerId = tdsTcsLedgerToUpdate._id.toString();
    }

    const newReceipt = new Receipt({
      schoolId,
      receiptVoucherNumber,
      entryDate,
      receiptDate,
      narration,
      paymentMode,
      chequeNumber,
      transactionNumber,
      itemDetails: updatedItemDetails,
      subTotalAmount,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      TDSTCSRateWithAmount,
      totalAmount,
      receiptImage: receiptImageFullPath,
      chequeImageForReceipt: chequeImageForReceiptFullPath,
      ledgerIdWithPaymentMode,
      status,
      academicYear,
      TDSorTCSLedgerId,
    });

    await newReceipt.save({ session });

    // Store all ledger IDs that need to be updated
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers (Debit) - Aggregate amounts by ledgerId first
    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);
    // 1. Item Ledgers (Credit)

    for (const [ledgerId, amount] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        newReceipt._id,
        0,
        amount
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // 2. TDS/TCS Ledger (Debit for TDS, Credit for TCS)

    if (TDSorTCS && TDSTCSRateWithAmount > 0 && TDSorTCSLedgerId) {
      if (TDSorTCS === "TDS") {
        // For TDS: Debit the TDS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSorTCSLedgerId,
          entryDate,
          newReceipt._id,
          Number(TDSTCSRateWithAmount), // debit
          0 // credit
        );
      } else if (TDSorTCS === "TCS") {
        // For TCS: Credit the TCS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSorTCSLedgerId,
          entryDate,
          newReceipt._id,
          0, // debit
          Number(TDSTCSRateWithAmount) // credit
        );
      }

      ledgerIdsToUpdate.add(TDSorTCSLedgerId);
    }

    // 3. Payment Mode Ledger (Debit)

    const tdsTcsAmount = Number(TDSTCSRateWithAmount) || 0;

    let paymentAmount;
    if (TDSorTCS === "TDS") {
      paymentAmount = toTwoDecimals(subTotalAmount - tdsTcsAmount);
    } else if (TDSorTCS === "TCS") {
      paymentAmount = toTwoDecimals(subTotalAmount + tdsTcsAmount);
    } else {
      paymentAmount = toTwoDecimals(subTotalAmount);
    }

    await updateOpeningClosingBalance(
      schoolId,
      academicYear,
      ledgerIdWithPaymentMode,
      entryDate,
      newReceipt._id,
      paymentAmount,
      0
    );
    ledgerIdsToUpdate.add(ledgerIdWithPaymentMode.toString());

    // --- Recalculate all ledgers that were updated ---
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
        const amount = parseFloat(item.amount) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          incomeBalance += -amount;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          expensesBalance += -amount;
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
      (detail) => detail.entryId?.toString() === newReceipt._id.toString()
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
        entryId: newReceipt._id,
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

    // =====Net Surplus/(Deficit)...Capital Fund=====

    // ========= Net Surplus/(Deficit) Ledger ===========

    // here for Net Surplus/(Deficit) Ledger whatever is store it as -ve value
    // exmple if amount is 100 then store it as -100 in Net Surplus/(Deficit)
    const netSurplusDeficitLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Net Surplus/(Deficit)",
    }).session(session);

    if (!netSurplusDeficitLedger) {
      throw new Error("Net Surplus/(Deficit) ledger not found");
    }

    // Calculate amounts for Net Surplus/(Deficit)
    let netSurplusCreditAmount = 0;
    let hasIncome = false;
    let hasExpenses = false;

    // Calculate income and expenses totals
    let incomeTotal = 0;
    let expensesTotal = 0;

    for (const item of updatedItemDetails) {
      const ledger = ledgers.find(
        (l) => l._id.toString() === item.ledgerId.toString()
      );

      if (ledger && ledger.headOfAccountId) {
        const headOfAccountName = ledger.headOfAccountId.headOfAccountName;
        const amount = parseFloat(item.amount) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          hasIncome = true;
          incomeTotal += amount;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          hasExpenses = true;
          expensesTotal += amount;
        }
      }
    }

    incomeTotal = toTwoDecimals(incomeTotal);
    expensesTotal = toTwoDecimals(expensesTotal);

    // Determine Net Surplus/(Deficit) amounts based on scenarios
    if (hasIncome && hasExpenses) {
      // Scenario 1: Both Income & Expenses
      netSurplusCreditAmount = incomeTotal - expensesTotal;
    } else if (hasIncome && !hasExpenses) {
      // Scenario 2: Only Income
      netSurplusCreditAmount = incomeTotal;
    } else if (!hasIncome && hasExpenses) {
      // Scenario 3: Only Expenses
      netSurplusCreditAmount = expensesTotal;
    }

    const negativeNetAmount = toTwoDecimals(netSurplusCreditAmount);

    // Update Net Surplus/(Deficit) ledger
    if (netSurplusCreditAmount !== 0) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        newReceipt._id,
        0,
        negativeNetAmount
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

    // ========= Capital Fund Ledger ===========
    // here for Capital Fund Ledger whatever is store it as value
    // exmple if amount is 100 then store it as 100 in Capital Fund

    const capitalFundLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Capital Fund",
    }).session(session);

    if (!capitalFundLedger) {
      throw new Error("Capital Fund ledger not found");
    }

    let capitalFundDebitAmount = 0;

    if (hasIncome && hasExpenses) {
      // Scenario 1: Credit Capital Fund with (income - expenses)
      capitalFundDebitAmount = incomeTotal - expensesTotal;
    } else if (hasIncome && !hasExpenses) {
      // Scenario 2: Credit Capital Fund with income amount
      capitalFundDebitAmount = incomeTotal;
    } else if (!hasIncome && hasExpenses) {
      // Scenario 3: Debit Capital Fund with expenses amount
      capitalFundDebitAmount = expensesTotal;
    }

    capitalFundDebitAmount = toTwoDecimals(capitalFundDebitAmount);

    if (capitalFundDebitAmount !== 0) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        newReceipt._id,
        capitalFundDebitAmount,
        0
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

    // =====Net Surplus/(Deficit)...Capital Fund=====

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      hasError: false,
      message: "Receipt created successfully!",
      data: newReceipt,
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
        message: `Duplicate entry for ${field}. Receipt already exists.`,
      });
    }

    console.error("Error creating Receipt:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
