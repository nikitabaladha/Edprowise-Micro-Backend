// Finance-Module/controllers/Inter-Service-Communication/BatchProcessFeesPayments.js
import mongoose from "mongoose";
import Receipt from "../../models/Receipt.js";
import Journal from "../../models/Journal.js";
import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";

function normalizeDateToUTCStartOfDay(date) {
  const newDate = new Date(date);
  // Convert to UTC start of day (00:00:00.000Z)
  return new Date(
    Date.UTC(
      newDate.getUTCFullYear(),
      newDate.getUTCMonth(),
      newDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

function normalizeDateToUTCEndOfDay(date) {
  const newDate = new Date(date);
  // Convert to UTC end of day (23:59:59.999Z)
  return new Date(
    Date.UTC(
      newDate.getUTCFullYear(),
      newDate.getUTCMonth(),
      newDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

function getStartAndEndOfDay(date) {
  const startOfDay = normalizeDateToUTCStartOfDay(date);
  const endOfDay = normalizeDateToUTCEndOfDay(date);
  return { startOfDay, endOfDay };
}

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function generateReceiptVoucherNumber(schoolId, financialYear) {
  const lastEntry = await Receipt.findOne(
    {
      schoolId,
      financialYear,
      status: { $in: ["Posted", "Cancelled"] },
      receiptVoucherNumber: { $exists: true, $ne: null },
    },
    { receiptVoucherNumber: 1 },
    { sort: { receiptVoucherNumber: -1 } }
  );

  let nextNumber = 1;

  if (lastEntry && lastEntry.receiptVoucherNumber) {
    const matches = lastEntry.receiptVoucherNumber.match(/\/(\d+)$/);
    if (matches && matches[1]) {
      nextNumber = parseInt(matches[1]) + 1;
    }
  }

  return `RVN/${financialYear}/${nextNumber}`;
}

async function generateJournalVoucherNumber(schoolId, financialYear) {
  const lastEntry = await Journal.findOne(
    // Changed from Receipt to Journal
    {
      schoolId,
      financialYear,
      status: { $in: ["Posted", "Cancelled"] },
      journalVoucherNumber: { $exists: true, $ne: null },
    },
    { journalVoucherNumber: 1 },
    { sort: { journalVoucherNumber: -1 } }
  );

  let nextNumber = 1;

  if (lastEntry && lastEntry.journalVoucherNumber) {
    const matches = lastEntry.journalVoucherNumber.match(/\/(\d+)$/);
    if (matches && matches[1]) {
      nextNumber = parseInt(matches[1]) + 1;
    }
  }

  return `JVN/${financialYear}/${nextNumber}`;
}

async function getFeeLedger(schoolId, financialYear, feeType, session) {
  let ledgerName;

  switch (feeType) {
    case "Registration":
      ledgerName = "Registration Fee";
      break;
    case "Admission":
      ledgerName = "Admission Fee";
      break;
    case "TC":
      ledgerName = "Transfer Certificate Fee";
      break;
    case "Board Registration":
      ledgerName = "Board Registration Fee";
      break;
    case "Board Exam":
      ledgerName = "Board Exam Fee";
      break;
    case "Excess":
      ledgerName = "Excess"; // Directly use "Excess" as ledger name
      break;
    case "Fine":
      ledgerName = "Fine"; // Directly use "Fine" as ledger name
      break;
    default:
      ledgerName = feeType;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    financialYear,
    ledgerName: ledgerName,
  }).session(session);

  if (!ledger) {
    throw new Error(`${ledgerName} ledger not found in the system`);
  }

  return ledger;
}

async function getPaymentMethodLedger(
  schoolId,
  financialYear,
  paymentMode,
  session
) {
  let ledgerName;

  switch (paymentMode) {
    case "Cash":
      ledgerName = "Cash Account";
      break;
    case "Online":
      ledgerName = "Online";
      break;
    case "Cheque":
      ledgerName = "Cheque";
      break;
    default:
      throw new Error(`Unsupported payment mode: ${paymentMode}`);
  }

  const ledger = await Ledger.findOne({
    schoolId,
    financialYear,
    ledgerName: ledgerName,
  }).session(session);

  if (!ledger) {
    throw new Error(`${ledgerName} ledger not found in the system`);
  }

  return ledger;
}

async function getPaymentMethodLedgerForConcessionJournal(
  schoolId,
  financialYear,
  paymentMode,
  session
) {
  let ledgerName;

  switch (paymentMode) {
    case "Cash":
      ledgerName = "School Fee Concession & Educational Assistance";
      break;
    case "Online":
      ledgerName = "School Fee Concession & Educational Assistance";
      break;
    case "Cheque":
      ledgerName = "School Fee Concession & Educational Assistance";
      break;
    default:
      throw new Error(`Unsupported payment mode: ${paymentMode}`);
  }

  const ledger = await Ledger.findOne({
    schoolId,
    financialYear,
    ledgerName: ledgerName,
  }).session(session);

  if (!ledger) {
    throw new Error(`${ledgerName} ledger not found in the system`);
  }

  return ledger;
}

async function getNetSurplusDeficitLedger(schoolId, financialYear, session) {
  const ledger = await Ledger.findOne({
    schoolId,
    financialYear,
    ledgerName: "Net Surplus/(Deficit)",
  }).session(session);

  if (!ledger) {
    throw new Error("Net Surplus/(Deficit) ledger not found in the system");
  }

  return ledger;
}

async function getCapitalFundLedger(schoolId, financialYear, session) {
  const ledger = await Ledger.findOne({
    schoolId,
    financialYear,
    ledgerName: "Capital Fund",
  }).session(session);

  if (!ledger) {
    throw new Error("Capital Fund ledger not found in the system");
  }

  return ledger;
}

async function findOrCreateReceipt(
  schoolId,
  financialYear,
  entryDate,
  paymentMode,
  session,
  preGeneratedVoucherNumber = null // Add this parameter
) {
  const paymentMethodLedger = await getPaymentMethodLedger(
    schoolId,
    financialYear,
    paymentMode,
    session
  );

  // Normalize the incoming date to start of day for comparison
  const normalizedEntryDate = normalizeDateToUTCStartOfDay(new Date(entryDate));
  const { startOfDay, endOfDay } = getStartAndEndOfDay(new Date(entryDate));

  const existingReceipt = await Receipt.findOne({
    schoolId,
    financialYear,
    entryDate: {
      $gte: startOfDay,
      $lt: endOfDay,
    },
    itemDetails: {
      $elemMatch: {
        ledgerId: paymentMethodLedger._id.toString(),
      },
    },
    status: "Posted",
  }).session(session);

  if (existingReceipt) {
    return existingReceipt;
  }

  // Use pre-generated voucher number if provided, otherwise generate new one
  const receiptVoucherNumber =
    preGeneratedVoucherNumber ||
    (await generateReceiptVoucherNumber(schoolId, financialYear));

  const newReceipt = new Receipt({
    schoolId,
    financialYear,
    receiptVoucherNumber,
    customizeEntry: true,
    entryDate: normalizedEntryDate, // Use normalized date
    receiptDate: normalizedEntryDate, // Use normalized date
    narration: "Auto-generated from Fees Module",
    itemDetails: [],
    subTotalAmount: 0,
    subTotalOfDebit: 0,
    totalAmount: 0,
    totalDebitAmount: 0,
    status: "Posted",
    approvalStatus: "Pending",
    sourceModule: "Fees",
    isAutoGenerated: true,
  });

  await newReceipt.save({ session });
  return newReceipt;
}

async function findOrCreateConcessionJournal(
  schoolId,
  financialYear,
  entryDate,
  paymentMode,
  session
) {
  const paymentMethodLedger = await getPaymentMethodLedgerForConcessionJournal(
    schoolId,
    financialYear,
    paymentMode,
    session
  );

  // Normalize the incoming date to start of day for comparison
  const normalizedEntryDate = normalizeDateToUTCStartOfDay(new Date(entryDate));
  const { startOfDay, endOfDay } = getStartAndEndOfDay(new Date(entryDate));

  const existingJournal = await Journal.findOne({
    schoolId,
    financialYear,
    entryDate: {
      $gte: startOfDay,
      $lt: endOfDay,
    },
    itemDetails: {
      $elemMatch: {
        ledgerId: paymentMethodLedger._id.toString(),
      },
    },
    status: "Posted",
    sourceModule: "Fees",
    isAutoGenerated: true,
  }).session(session);

  if (existingJournal) {
    return existingJournal;
  }

  const journalVoucherNumber = await generateJournalVoucherNumber(
    schoolId,
    financialYear
  );

  const newJournal = new Journal({
    schoolId,
    financialYear,
    journalVoucherNumber,
    customizeEntry: true,
    entryDate: normalizedEntryDate,
    documentDate: normalizedEntryDate,
    narration: "Auto-generated concession from Fees Module",
    itemDetails: [],
    subTotalOfDebit: 0,
    subTotalOfCredit: 0,
    totalAmountOfDebit: 0,
    totalAmountOfCredit: 0,
    status: "Posted",
    approvalStatus: "Pending",
    sourceModule: "Fees",
    isAutoGenerated: true,
  });

  await newJournal.save({ session });
  return newJournal;
}

async function updateReceiptWithFeePayment(
  receipt,
  feeLedger,
  paymentMethodLedger,
  finalAmount,
  session
) {
  // No need to modify the receipt date here, it's already normalized
  const entryDate = receipt.entryDate;

  const existingFeeItemIndex = receipt.itemDetails.findIndex(
    (item) => item.ledgerId.toString() === feeLedger._id.toString()
  );

  const existingPaymentItemIndex = receipt.itemDetails.findIndex(
    (item) => item.ledgerId.toString() === paymentMethodLedger._id.toString()
  );

  if (existingFeeItemIndex !== -1) {
    receipt.itemDetails[existingFeeItemIndex].amount = toTwoDecimals(
      receipt.itemDetails[existingFeeItemIndex].amount + finalAmount
    );
  } else {
    receipt.itemDetails.push({
      itemName: `Fee - ${feeLedger.ledgerName}`,
      ledgerId: feeLedger._id.toString(),
      amount: toTwoDecimals(finalAmount),
      debitAmount: 0,
    });
  }

  if (existingPaymentItemIndex !== -1) {
    receipt.itemDetails[existingPaymentItemIndex].debitAmount = toTwoDecimals(
      receipt.itemDetails[existingPaymentItemIndex].debitAmount + finalAmount
    );
  } else {
    receipt.itemDetails.push({
      itemName: `Payment Fee- ${feeLedger.ledgerName}`,
      ledgerId: paymentMethodLedger._id.toString(),
      amount: 0,
      debitAmount: toTwoDecimals(finalAmount),
    });
  }

  receipt.subTotalAmount = toTwoDecimals(
    receipt.itemDetails.reduce((sum, item) => sum + (item.amount || 0), 0)
  );
  receipt.subTotalOfDebit = toTwoDecimals(
    receipt.itemDetails.reduce((sum, item) => sum + (item.debitAmount || 0), 0)
  );
  receipt.totalAmount = receipt.subTotalAmount;
  receipt.totalDebitAmount = receipt.subTotalOfDebit;

  await receipt.save({ session });
  return receipt;
}

async function updateConcessionJournalWithFeePayment(
  journal,
  feeLedger,
  paymentMethodLedger, // This is now the concession ledger
  concessionAmount,
  session
) {
  const entryDate = journal.entryDate;

  // Find existing fee ledger item in journal
  const existingFeeItemIndex = journal.itemDetails.findIndex(
    (item) => item.ledgerId.toString() === feeLedger._id.toString()
  );

  const existingPaymentItemIndex = journal.itemDetails.findIndex(
    (item) => item.ledgerId.toString() === paymentMethodLedger._id.toString()
  );

  // Update or add fee ledger item (CREDIT side for concession)
  if (existingFeeItemIndex !== -1) {
    journal.itemDetails[existingFeeItemIndex].creditAmount = toTwoDecimals(
      journal.itemDetails[existingFeeItemIndex].creditAmount + concessionAmount
    );
  } else {
    journal.itemDetails.push({
      description: `Concession - ${feeLedger.ledgerName}`,
      ledgerId: feeLedger._id.toString(),
      debitAmount: 0,
      creditAmount: toTwoDecimals(concessionAmount),
    });
  }

  // Update or add concession ledger item (DEBIT side for concession)
  if (existingPaymentItemIndex !== -1) {
    journal.itemDetails[existingPaymentItemIndex].debitAmount = toTwoDecimals(
      journal.itemDetails[existingPaymentItemIndex].debitAmount +
        concessionAmount
    );
  } else {
    journal.itemDetails.push({
      description: `Concession - ${feeLedger.ledgerName}`,
      ledgerId: paymentMethodLedger._id.toString(),
      debitAmount: toTwoDecimals(concessionAmount),
      creditAmount: 0,
    });
  }

  // Recalculate totals
  journal.subTotalOfDebit = toTwoDecimals(
    journal.itemDetails.reduce((sum, item) => sum + (item.debitAmount || 0), 0)
  );
  journal.subTotalOfCredit = toTwoDecimals(
    journal.itemDetails.reduce((sum, item) => sum + (item.creditAmount || 0), 0)
  );
  journal.totalAmountOfDebit = journal.subTotalOfDebit;
  journal.totalAmountOfCredit = journal.subTotalOfCredit;

  await journal.save({ session });
  return journal;
}

// ===== OPENING CLOSING BALANCE FUNCTIONS =====

async function getOrCreateOpeningBalanceRecord(
  schoolId,
  financialYear,
  ledgerId,
  entryDate,
  session
) {
  const ledger = await Ledger.findOne({
    schoolId,
    financialYear,
    _id: ledgerId,
  }).session(session);

  let openingBalance = 0;
  let balanceType = "Debit";

  if (ledger) {
    balanceType = ledger.balanceType;
    openingBalance = ledger.openingBalance || 0;
  }

  let record = await OpeningClosingBalance.findOne({
    schoolId,
    financialYear,
    ledgerId,
  }).session(session);

  if (!record) {
    record = new OpeningClosingBalance({
      schoolId,
      financialYear,
      ledgerId,
      balanceDetails: [],
      balanceType,
    });
  }

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
  financialYear,
  ledgerId,
  entryDate,
  receiptEntryId,
  debitAmount = 0,
  creditAmount = 0,
  session
) {
  debitAmount = toTwoDecimals(debitAmount);
  creditAmount = toTwoDecimals(creditAmount);

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      financialYear,
      ledgerId,
      entryDate,
      session
    );

  // Find if there's already an entry for this exact date and receiptEntryId
  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) =>
      new Date(detail.entryDate).getTime() === new Date(entryDate).getTime() &&
      detail.entryId?.toString() === receiptEntryId.toString()
  );

  if (existingEntryIndex !== -1) {
    // UPDATE EXISTING ENTRY (Same date, same receipt)
    const existingEntry = record.balanceDetails[existingEntryIndex];

    // Keep the original openingBalance, just update debit/credit
    existingEntry.debit = toTwoDecimals(existingEntry.debit + debitAmount);
    existingEntry.credit = toTwoDecimals(existingEntry.credit + creditAmount);

    // Recalculate closing balance
    if (balanceType === "Debit") {
      existingEntry.closingBalance = toTwoDecimals(
        existingEntry.openingBalance +
          existingEntry.debit -
          existingEntry.credit
      );
    } else {
      existingEntry.closingBalance = toTwoDecimals(
        existingEntry.openingBalance +
          existingEntry.debit -
          existingEntry.credit
      );
    }
  } else {
    // CREATE NEW ENTRY
    const previousBalanceDetails = record.balanceDetails
      .filter((detail) => new Date(detail.entryDate) < new Date(entryDate))
      .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

    let effectiveOpeningBalance = toTwoDecimals(openingBalance);

    if (previousBalanceDetails.length > 0) {
      // Use the last closing balance from previous dates
      effectiveOpeningBalance = toTwoDecimals(
        previousBalanceDetails[0].closingBalance
      );
    }

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

    const newBalanceDetail = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: receiptEntryId,
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

  await record.save({ session });
  return record;
}

async function updateOpeningClosingForFeePayment(
  schoolId,
  financialYear,
  receipt,
  feeLedger,
  paymentMethodLedger,
  finalAmount,
  session
) {
  const entryDate = receipt.entryDate;
  const receiptEntryId = receipt._id;

  // Store all ledger IDs that need to be updated
  const ledgerIdsToUpdate = new Set();

  // ===== 1. Update Fee Ledger (Income Account) =====
  let feeDebitAmount = 0;
  let feeCreditAmount = 0;

  if (finalAmount >= 0) {
    // Positive amount: credit the income account
    feeCreditAmount = finalAmount;
  } else {
    // Negative amount: debit the income account (refund scenario)
    feeDebitAmount = Math.abs(finalAmount);
  }

  await updateOpeningClosingBalance(
    schoolId,
    financialYear,
    feeLedger._id,
    entryDate,
    receiptEntryId,
    feeDebitAmount,
    feeCreditAmount,
    session
  );
  ledgerIdsToUpdate.add(feeLedger._id.toString());

  // ===== 2. Update Payment Method Ledger (Asset Account) =====
  let paymentMethodDebitAmount = 0;
  let paymentMethodCreditAmount = 0;

  if (finalAmount >= 0) {
    // Positive amount: debit the asset account (money coming in)
    paymentMethodDebitAmount = finalAmount;
  } else {
    // Negative amount: credit the asset account (money going out - refund)
    paymentMethodCreditAmount = Math.abs(finalAmount);
  }

  await updateOpeningClosingBalance(
    schoolId,
    financialYear,
    paymentMethodLedger._id,
    entryDate,
    receiptEntryId,
    paymentMethodDebitAmount,
    paymentMethodCreditAmount,
    session
  );
  ledgerIdsToUpdate.add(paymentMethodLedger._id.toString());

  // ===== 3. Update Net Surplus/(Deficit) and Capital Fund Ledgers =====
  const netSurplusDeficitLedger = await getNetSurplusDeficitLedger(
    schoolId,
    financialYear,
    session
  );
  const capitalFundLedger = await getCapitalFundLedger(
    schoolId,
    financialYear,
    session
  );

  let netSurplusDebitAmount = 0;
  let netSurplusCreditAmount = 0;
  let capitalFundDebitAmount = 0;
  let capitalFundCreditAmount = 0;

  if (finalAmount >= 0) {
    // POSITIVE AMOUNT (Income Received)
    // Net Surplus/(Deficit): Same side as Payment Method (Debit)
    netSurplusDebitAmount = finalAmount;
    // Capital Fund: Same side as Fee Ledger (Credit)
    capitalFundCreditAmount = finalAmount;
  } else {
    // NEGATIVE AMOUNT (Refund Given)
    const absAmount = Math.abs(finalAmount);
    // Net Surplus/(Deficit): Same side as Payment Method (Credit)
    netSurplusCreditAmount = absAmount;
    // Capital Fund: Same side as Fee Ledger (Debit)
    capitalFundDebitAmount = absAmount;
  }

  // Update Net Surplus/(Deficit) ledger
  if (netSurplusDebitAmount > 0 || netSurplusCreditAmount > 0) {
    await updateOpeningClosingBalance(
      schoolId,
      financialYear,
      netSurplusDeficitLedger._id,
      entryDate,
      receiptEntryId,
      netSurplusDebitAmount,
      netSurplusCreditAmount,
      session
    );
    ledgerIdsToUpdate.add(netSurplusDeficitLedger._id.toString());
  }

  // Update Capital Fund ledger
  if (capitalFundDebitAmount > 0 || capitalFundCreditAmount > 0) {
    await updateOpeningClosingBalance(
      schoolId,
      financialYear,
      capitalFundLedger._id,
      entryDate,
      receiptEntryId,
      capitalFundDebitAmount,
      capitalFundCreditAmount,
      session
    );
    ledgerIdsToUpdate.add(capitalFundLedger._id.toString());
  }

  return ledgerIdsToUpdate;
}

async function updateOpeningClosingForConcessionJournal(
  schoolId,
  financialYear,
  journal,
  feeLedger,
  paymentMethodLedger, // This is the concession ledger
  concessionAmount,
  session
) {
  const entryDate = journal.entryDate;
  const journalEntryId = journal._id;

  // Store all ledger IDs that need to be updated
  const ledgerIdsToUpdate = new Set();

  // ===== 1. Update Fee Ledger (Income Account) - CREDIT for concession =====
  // For concession, we CREDIT the fee ledger (reducing income)
  await updateOpeningClosingBalance(
    schoolId,
    financialYear,
    feeLedger._id,
    entryDate,
    journalEntryId,
    0, // No debit
    concessionAmount, // ✅ CREDIT the fee ledger (reducing income)
    session
  );
  ledgerIdsToUpdate.add(feeLedger._id.toString());

  // ===== 2. Update Concession Ledger - DEBIT for concession =====
  // For concession, we DEBIT the concession ledger
  await updateOpeningClosingBalance(
    schoolId,
    financialYear,
    paymentMethodLedger._id, // "School Fee Concession & Educational Assistance"
    entryDate,
    journalEntryId,
    concessionAmount, // ✅ DEBIT the concession ledger
    0, // No credit
    session
  );
  ledgerIdsToUpdate.add(paymentMethodLedger._id.toString());

  // ===== 3. Update Net Surplus/(Deficit) and Capital Fund Ledgers =====
  const netSurplusDeficitLedger = await getNetSurplusDeficitLedger(
    schoolId,
    financialYear,
    session
  );
  const capitalFundLedger = await getCapitalFundLedger(
    schoolId,
    financialYear,
    session
  );

  // For concession:
  // Net Surplus/(Deficit): CREDIT (reducing surplus/increasing deficit)
  await updateOpeningClosingBalance(
    schoolId,
    financialYear,
    netSurplusDeficitLedger._id,
    entryDate,
    journalEntryId,
    0, // No debit
    concessionAmount, // ✅ CREDIT Net Surplus/(Deficit)
    session
  );
  ledgerIdsToUpdate.add(netSurplusDeficitLedger._id.toString());

  // Capital Fund: DEBIT (reducing capital fund)
  await updateOpeningClosingBalance(
    schoolId,
    financialYear,
    capitalFundLedger._id,
    entryDate,
    journalEntryId,
    concessionAmount, // ✅ DEBIT Capital Fund
    0, // No credit
    session
  );
  ledgerIdsToUpdate.add(capitalFundLedger._id.toString());

  return ledgerIdsToUpdate;
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

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  let currentBalance = toTwoDecimals(record.balanceDetails[0].openingBalance);

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = detail.openingBalance;
    } else {
      detail.openingBalance = toTwoDecimals(
        record.balanceDetails[i - 1].closingBalance
      );
      currentBalance = detail.openingBalance;
    }

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

  await record.save({ session });
}

async function processBatchPaymentsForDate(
  schoolId,
  financialYear,
  processDate,
  paymentsData
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Group payments by paymentMode and date for receipt creation
    const paymentsByMode = {};

    paymentsData.forEach((payment) => {
      const key = `${payment.paymentMode}_${payment.paymentDate}`;
      if (!paymentsByMode[key]) {
        paymentsByMode[key] = [];
      }
      paymentsByMode[key].push(payment);
    });

    const allLedgerIdsToUpdate = new Set();

    // Get the number of groups that will need new receipts
    const groupKeys = Object.keys(paymentsByMode).filter(
      (key) => !key.startsWith("null_")
    );

    // Generate sequential voucher numbers for all new receipts that will be created
    let currentVoucherNumber = await generateReceiptVoucherNumber(
      schoolId,
      financialYear
    );

    const voucherNumbers = [];
    for (let i = 0; i < groupKeys.length; i++) {
      voucherNumbers.push(currentVoucherNumber);

      // Increment the voucher number for next one
      const matches = currentVoucherNumber.match(/\/(\d+)$/);
      if (matches && matches[1]) {
        const nextNum = parseInt(matches[1]) + 1;
        currentVoucherNumber = `RVN/${financialYear}/${nextNum}`;
      }
    }

    let voucherIndex = 0;

    // ✅ FIXED: Only create concession journals when we have School Fees payments
    const concessionJournals = {};
    const schoolFeesPaymentModes = new Set();

    // First, identify which payment modes actually have School Fees with concession
    for (const [key, payments] of Object.entries(paymentsByMode)) {
      const [paymentMode, paymentDate] = key.split("_");

      if (paymentMode === "null") continue;

      // Check if this group has any School Fees payments with concession
      const hasSchoolFeesWithConcession = payments.some(
        (payment) =>
          payment.source === "SchoolFees" &&
          payment.type === "feeItem" &&
          payment.concessionAmount > 0
      );

      if (hasSchoolFeesWithConcession) {
        schoolFeesPaymentModes.add(paymentMode);
      }
    }

    // Pre-create concession journals only for payment modes that need them
    for (const paymentMode of schoolFeesPaymentModes) {
      const concessionJournal = await findOrCreateConcessionJournal(
        schoolId,
        financialYear,
        new Date(processDate), // Use the process date
        paymentMode,
        session
      );
      concessionJournals[paymentMode] = concessionJournal;
    }

    // Process each group (payment mode + date combination)
    for (const [key, payments] of Object.entries(paymentsByMode)) {
      const [paymentMode, paymentDate] = key.split("_");

      if (paymentMode === "null") continue;

      // Get the first payment to use for receipt creation
      const firstPayment = payments[0];

      // Find or create receipt for this date and payment mode
      const receipt = await findOrCreateReceipt(
        schoolId,
        financialYear,
        new Date(paymentDate),
        paymentMode,
        session,
        voucherNumbers[voucherIndex] // Pass the pre-generated voucher number
      );

      voucherIndex++;

      // Process all payments for this group
      for (const payment of payments) {
        try {
          const feeLedger = await getFeeLedger(
            schoolId,
            financialYear,
            payment.feeType,
            session
          );

          const paymentMethodLedger = await getPaymentMethodLedger(
            schoolId,
            financialYear,
            payment.paymentMode,
            session
          );

          // Update receipt with this payment
          const updatedReceipt = await updateReceiptWithFeePayment(
            receipt,
            feeLedger,
            paymentMethodLedger,
            payment.finalAmount,
            session
          );

          // Update opening closing balance for receipt
          const ledgerIdsToUpdate = await updateOpeningClosingForFeePayment(
            schoolId,
            financialYear,
            updatedReceipt,
            feeLedger,
            paymentMethodLedger,
            payment.finalAmount,
            session
          );

          ledgerIdsToUpdate.forEach((id) => allLedgerIdsToUpdate.add(id));

          if (
            payment.source === "SchoolFees" &&
            payment.type === "feeItem" &&
            payment.concessionAmount > 0
          ) {
            try {
              // Get the concession journal for this payment mode (should already exist)
              const concessionJournal = concessionJournals[payment.paymentMode];

              if (concessionJournal) {
                const concessionLedger =
                  await getPaymentMethodLedgerForConcessionJournal(
                    schoolId,
                    financialYear,
                    payment.paymentMode,
                    session
                  );

                // Update concession journal with this concession
                const updatedConcessionJournal =
                  await updateConcessionJournalWithFeePayment(
                    concessionJournal,
                    feeLedger,
                    concessionLedger,
                    payment.concessionAmount,
                    session
                  );

                // Update opening closing balance for concession journal
                const concessionLedgerIds =
                  await updateOpeningClosingForConcessionJournal(
                    schoolId,
                    financialYear,
                    updatedConcessionJournal,
                    feeLedger,
                    concessionLedger,
                    payment.concessionAmount,
                    session
                  );

                concessionLedgerIds.forEach((id) =>
                  allLedgerIdsToUpdate.add(id)
                );
              } else {
                console.log(
                  `No concession journal found for payment mode: ${payment.paymentMode}`
                );
              }
            } catch (concessionError) {
              console.error(
                `Error processing concession for payment ${payment.paymentId}:`,
                concessionError.message
              );
              console.error("Concession error stack:", concessionError.stack);
              // Continue with next payment even if concession processing fails
            }
          }
        } catch (error) {
          console.error(
            `Error processing payment ${payment.paymentId} (FeeType: ${payment.feeType}):`,
            error.message
          );
          // Continue with next payment even if one fails
          continue;
        }
      }
    }

    // Recalculate all ledgers that were updated
    for (const ledgerId of allLedgerIdsToUpdate) {
      await recalculateLedgerBalances(
        schoolId,
        financialYear,
        ledgerId,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: `Successfully processed ${paymentsData.length} payments`,
      processedCount: paymentsData.length,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

async function batchProcessFeesPayments(req, res) {
  try {
    const { schoolId, financialYear, processDate } = req.body;

    if (!schoolId || !financialYear || !processDate) {
      return res.status(400).json({
        hasError: true,
        message:
          "Missing required fields: schoolId, financialYear, processDate",
      });
    }

    const { paymentsData } = req.body;

    if (!paymentsData || !Array.isArray(paymentsData)) {
      return res.status(400).json({
        hasError: true,
        message: "paymentsData array is required",
      });
    }

    const result = await processBatchPaymentsForDate(
      schoolId,
      financialYear,
      new Date(processDate),
      paymentsData
    );

    return res.status(200).json({
      hasError: false,
      ...result,
    });
  } catch (error) {
    console.error("Error in batch processing:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error during batch processing",
      error: error.message,
    });
  }
}

export default batchProcessFeesPayments;
