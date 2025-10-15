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

function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const amount = parseFloat(item.amount) || 0;

    if (ledgerMap.has(ledgerId)) {
      ledgerMap.set(ledgerId, toTwoDecimals(ledgerMap.get(ledgerId) + amount));
    } else {
      ledgerMap.set(ledgerId, toTwoDecimals(amount));
    }
  });

  return ledgerMap;
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
  receiptId,
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

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) => detail.entryId?.toString() === receiptId.toString()
  );

  let entrySequence;

  if (existingEntryIndex !== -1) {
    const existing = record.balanceDetails[existingEntryIndex];
    entrySequence = existing.entrySequence;

    let effectiveOpeningBalance = openingBalance;

    if (existingEntryIndex > 0) {
      effectiveOpeningBalance = toTwoDecimals(
        record.balanceDetails[existingEntryIndex - 1].closingBalance
      );
    } else {
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
        effectiveOpeningBalance = openingBalance;
      }
    }

    const closingBalance = toTwoDecimals(
      effectiveOpeningBalance + debitAmount - creditAmount
    );

    existing.debit = debitAmount;
    existing.credit = creditAmount;
    existing.entryDate = entryDate;
    existing.openingBalance = effectiveOpeningBalance;
    existing.closingBalance = closingBalance;
  } else {
    const sameDayEntries = record.balanceDetails.filter(
      (d) =>
        new Date(d.entryDate).toDateString() ===
        new Date(entryDate).toDateString()
    );

    entrySequence =
      sameDayEntries.length > 0
        ? Math.max(...sameDayEntries.map((d) => d.entrySequence || 0)) + 1
        : 1;

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
      entryId: receiptId,
    };

    record.balanceDetails.push(newBalanceDetail);
  }

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  await record.save({ session });
  return record;
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

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

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

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

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

async function removeReceiptEntryFromLedger(
  schoolId,
  academicYear,
  receiptId,
  ledgerId,
  session
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session);

  if (!record) return;

  const originalLength = record.balanceDetails.length;
  record.balanceDetails = record.balanceDetails.filter(
    (detail) => detail.entryId?.toString() !== receiptId.toString()
  );

  if (record.balanceDetails.length === originalLength) return;
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

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

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    if (i === 0) {
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

async function updateById(req, res) {
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

    const { error } = ReceiptValidator.ReceiptValidatorUpdate.validate(
      req.body
    );
    if (error) {
      await session.abortTransaction();
      session.endSession();
      const errorMessages = error.details.map((err) => err.message).join(", ");
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
      TDSTCSRateWithAmount,
      ledgerIdWithPaymentMode,
      totalAmount,
      status,
    } = req.body;

    const existingReceipt = await Receipt.findOne({
      _id: id,
      schoolId,
      academicYear,
    }).session(session);

    if (!existingReceipt) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "Receipt not found.",
      });
    }

    // --- Track old ledger IDs like Contra does ---
    const oldItemLedgerIds = existingReceipt.itemDetails.map((item) =>
      item.ledgerId?.toString()
    );
    const oldTDSorTCSLedgerId = existingReceipt.TDSorTCSLedgerId?.toString();
    const oldPaymentModeLedgerId =
      existingReceipt.ledgerIdWithPaymentMode?.toString();

    // Store old values for comparison
    const oldEntryDate = existingReceipt.entryDate;
    const oldItemDetails = existingReceipt.itemDetails;
    const oldTDSorTCS = existingReceipt.TDSorTCS;
    const oldTDSTCSRateWithAmount = existingReceipt.TDSTCSRateWithAmount;
    const oldLedgerIdWithPaymentMode = existingReceipt.ledgerIdWithPaymentMode;

    // Handle uploaded files
    const { receiptImage, chequeImageForReceipt } = req.files || {};

    if (receiptImage?.[0]) {
      const receiptImagePath = receiptImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/ReceiptImage"
        : "/Documents/FinanceModule/ReceiptImage";
      existingReceipt.receiptImage = `${receiptImagePath}/${receiptImage[0].filename}`;
    }

    if (chequeImageForReceipt?.[0]) {
      const chequeImageForReceiptPath =
        chequeImageForReceipt[0].mimetype.startsWith("image/")
          ? "/Images/FinanceModule/ChequeImageForReceipt"
          : "/Documents/FinanceModule/ChequeImageForReceipt";
      existingReceipt.chequeImageForReceipt = `${chequeImageForReceiptPath}/${chequeImageForReceipt[0].filename}`;
    }

    // Recalculate item details amounts
    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amount: toTwoDecimals(parseFloat(item.amount) || 0),
    }));

    const subTotalAmount = toTwoDecimals(
      updatedItemDetails.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0
      )
    );

    const parsedTDSTCSRateWithAmount = toTwoDecimals(
      parseFloat(TDSTCSRateWithAmount) || 0
    );

    // Update fields
    existingReceipt.entryDate = entryDate;
    existingReceipt.receiptDate = receiptDate;
    existingReceipt.narration = narration;
    existingReceipt.paymentMode = paymentMode;
    existingReceipt.chequeNumber = chequeNumber;
    existingReceipt.itemDetails = updatedItemDetails;
    existingReceipt.TDSorTCS = TDSorTCS;
    existingReceipt.TDSTCSRateChartId = TDSTCSRateChartId;
    existingReceipt.TDSTCSRate = TDSTCSRate;
    existingReceipt.TDSTCSRateWithAmount = parsedTDSTCSRateWithAmount;
    existingReceipt.subTotalAmount = subTotalAmount;
    existingReceipt.totalAmount = totalAmount;
    existingReceipt.ledgerIdWithPaymentMode = ledgerIdWithPaymentMode;
    existingReceipt.status = status;

    if (paymentMode === "Online" && !existingReceipt.transactionNumber) {
      existingReceipt.transactionNumber = await generateTransactionNumber();
    }

    // --- Step A: Reset old balances to zero first (like Contra does) ---
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

    await existingReceipt.save({ session });

    // --- Step B: Remove old entries if ledgers changed or removed (like Contra) ---

    // Get new ledger IDs
    const newItemLedgerIds = updatedItemDetails.map((item) =>
      item.ledgerId?.toString()
    );
    const newPaymentModeLedgerId = ledgerIdWithPaymentMode?.toString();

    // Handle TDS/TCS ledger
    let newTDSorTCSLedgerId = null;
    if (TDSorTCS && parsedTDSTCSRateWithAmount > 0) {
      const ledgerNameToFind =
        TDSorTCS === "TDS" ? "TDS on Receipts" : "TCS on Receipts";
      let tdsTcsLedger = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: { $regex: new RegExp(`^${ledgerNameToFind}$`, "i") },
      }).session(session);

      if (tdsTcsLedger) {
        newTDSorTCSLedgerId = tdsTcsLedger._id.toString();
        existingReceipt.TDSorTCSLedgerId = newTDSorTCSLedgerId;
      }
    } else {
      existingReceipt.TDSorTCSLedgerId = null;
    }
    await existingReceipt.save({ session });

    // Remove entries from old ledgers that are no longer used
    for (const oldLedgerId of oldItemLedgerIds) {
      if (oldLedgerId && !newItemLedgerIds.includes(oldLedgerId)) {
        await removeReceiptEntryFromLedger(
          schoolId,
          academicYear,
          id,
          oldLedgerId,
          session
        );
      }
    }

    // Remove old TDS/TCS ledger entry if removed or changed
    if (oldTDSorTCSLedgerId && oldTDSorTCSLedgerId !== newTDSorTCSLedgerId) {
      await removeReceiptEntryFromLedger(
        schoolId,
        academicYear,
        id,
        oldTDSorTCSLedgerId,
        session
      );
    }

    // Remove old payment mode ledger entry if changed
    if (
      oldPaymentModeLedgerId &&
      oldPaymentModeLedgerId !== newPaymentModeLedgerId
    ) {
      await removeReceiptEntryFromLedger(
        schoolId,
        academicYear,
        id,
        oldPaymentModeLedgerId,
        session
      );
    }

    // --- Step C: Apply new balances ---
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers (Credit) - Aggregate amounts by ledgerId
    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);

    for (const [ledgerId, amount] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        existingReceipt._id,
        0, // debit
        amount, // credit,
        session
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // 2. TDS/TCS Ledger
    const tdsTcsAmount = parsedTDSTCSRateWithAmount;

    if (TDSorTCS && tdsTcsAmount > 0 && newTDSorTCSLedgerId) {
      if (TDSorTCS === "TDS") {
        // For TDS: Debit the TDS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          newTDSorTCSLedgerId,
          entryDate,
          existingReceipt._id,
          tdsTcsAmount, // debit
          0, // credit
          session
        );
      } else if (TDSorTCS === "TCS") {
        // For TCS: Credit the TCS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          newTDSorTCSLedgerId,
          entryDate,
          existingReceipt._id,
          0, // debit
          tdsTcsAmount, // credit
          session
        );
      }
      ledgerIdsToUpdate.add(newTDSorTCSLedgerId);
    }

    // 3. Payment Mode Ledger (Debit)
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
      existingReceipt._id,
      paymentAmount, // debit
      0, // credit
      session
    );
    ledgerIdsToUpdate.add(ledgerIdWithPaymentMode.toString());

    // --- Step D: Recalculate all affected ledgers ---
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
        entryDate,
        session
      );
    }

    // Get all unique ledger IDs from updatedItemDetails
    const uniqueLedgerIds = [
      ...new Set(updatedItemDetails.map((item) => item.ledgerId)),
    ];

    // Find ledgers with their Head of Account information
    const ledgers = await Ledger.find({
      _id: { $in: uniqueLedgerIds },
    })
      .populate("headOfAccountId")
      .session(session);

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
      (detail) => detail.entryId?.toString() === id.toString()
    );

    if (existingEntryIndex !== -1) {
      // Update existing entry - REPLACE values
      totalNetRecord.balanceDetails[existingEntryIndex].incomeBalance =
        incomeBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].expensesBalance =
        expensesBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].totalBalance =
        totalBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].entryDate = entryDate;
    } else {
      // Create new entry if it doesn't exist
      totalNetRecord.balanceDetails.push({
        entryDate,
        entryId: existingReceipt._id,
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

    // ========= Net Surplus/(Deficit) Ledger and Capital Fund ===========

    const netSurplusDeficitLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Net Surplus/(Deficit)",
    }).session(session);

    if (!netSurplusDeficitLedger) {
      throw new Error("Net Surplus/(Deficit) ledger not found");
    }

    // Calculate amounts for Net Surplus/(Deficit)
    let netSurplusDebitAmount = 0;
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
      netSurplusDebitAmount = incomeTotal - expensesTotal;
    } else if (hasIncome && !hasExpenses) {
      // Scenario 2: Only Income
      netSurplusDebitAmount = incomeTotal;
    } else if (!hasIncome && hasExpenses) {
      // Scenario 3: Only Expenses
      netSurplusDebitAmount = expensesTotal;
    }

    netSurplusDebitAmount = toTwoDecimals(netSurplusDebitAmount);

    // Check if we need to remove the Net Surplus/(Deficit) entry completely
    if (netSurplusDebitAmount === 0) {
      // Remove the entry completely if amount is 0 (no income/expenses)
      await removeReceiptEntryFromLedger(
        schoolId,
        academicYear,
        id,
        netSurplusDeficitLedger._id,
        session
      );
    } else {
      // Update Net Surplus/(Deficit) ledger
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        existingReceipt._id,
        netSurplusDebitAmount,
        0,
        session
      );

      // Recalculate balances
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
        entryDate,
        session
      );
    }

    // ========= Capital Fund Ledger ===========
    const capitalFundLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Capital Fund",
    }).session(session);

    if (!capitalFundLedger) {
      throw new Error("Capital Fund ledger not found");
    }

    let capitalFundCreditAmount = 0;

    if (hasIncome && hasExpenses) {
      // Scenario 1: Credit Capital Fund with (income - expenses)
      capitalFundCreditAmount = incomeTotal - expensesTotal;
    } else if (hasIncome && !hasExpenses) {
      // Scenario 2: Credit Capital Fund with income amount
      capitalFundCreditAmount = incomeTotal;
    } else if (!hasIncome && hasExpenses) {
      // Scenario 3: Debit Capital Fund with expenses amount
      capitalFundCreditAmount = expensesTotal;
    }

    capitalFundCreditAmount = toTwoDecimals(capitalFundCreditAmount);

    // Check if we need to remove the Capital Fund entry completely
    if (capitalFundCreditAmount === 0) {
      // Remove the entry completely if amount is 0 (no income/expenses)
      await removeReceiptEntryFromLedger(
        schoolId,
        academicYear,
        id,
        capitalFundLedger._id,
        session
      );
    } else {
      // Update Capital Fund ledger
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        existingReceipt._id,
        0,
        capitalFundCreditAmount,
        session
      );

      // Recalculate balances
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
        entryDate,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Receipt updated successfully!",
      data: existingReceipt,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Receipt already exists.`,
      });
    }

    console.error("Error updating Receipt Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  } finally {
    session.endSession();
  }
}

export default updateById;
