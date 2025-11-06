// /Users/nikita/Desktop/EDPROWISE_Nikita_FINAL/Edprowise_Backend/Edprowise-Micro-Backend/Finance-Module/controllers/Inter-Service-Communication/addInReceiptForFees.js

import mongoose from "mongoose";
import Receipt from "../../models/Receipt.js";
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
    default:
      throw new Error(`Unsupported fee type: ${feeType}`);
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
  session
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

  const receiptVoucherNumber = await generateReceiptVoucherNumber(
    schoolId,
    financialYear
  );

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
      itemName: "",
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
      itemName: "",
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

    console.log(`Updated existing entry for date ${entryDate}:`, {
      openingBalance: existingEntry.openingBalance,
      debit: existingEntry.debit,
      credit: existingEntry.credit,
      closingBalance: existingEntry.closingBalance,
    });
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

    console.log(`Created new entry for date ${entryDate}:`, {
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance: closingBalance,
    });
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

    const ledger = await Ledger.findOne({
      schoolId,
      financialYear,
      _id: ledgerId,
    }).session(session);

    const balanceType = ledger?.balanceType || "Debit";

    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save({ session });
}

async function addInReceiptForFees(req, res) {
  console.log("============== addInReceiptForFees CALLED ================");
  console.log("Query params:", req.query);
  console.log("Body data:", req.body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { schoolId, financialYear } = req.query;
    const paymentData = req.body;

    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    if (!financialYear) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Financial Year is required in query.",
      });
    }

    const {
      paymentId,
      finalAmount,
      paymentDate,
      academicYear,
      paymentMode,
      feeType,
    } = paymentData;

    if (
      !paymentId ||
      !finalAmount ||
      !paymentDate ||
      !paymentMode ||
      !feeType
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message:
          "Missing required fields: paymentId, finalAmount, paymentDate, paymentMode, feeType",
      });
    }

    if (paymentMode === "null") {
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({
        hasError: false,
        message: "Payment mode is 'null', skipping receipt creation.",
      });
    }

    // Get required ledgers
    const feeLedger = await getFeeLedger(
      schoolId,
      financialYear,
      feeType,
      session
    );
    const paymentMethodLedger = await getPaymentMethodLedger(
      schoolId,
      financialYear,
      paymentMode,
      session
    );

    // Normalize the payment date to start of day
    const normalizedPaymentDate = normalizeDateToUTCStartOfDay(
      new Date(paymentDate)
    );

    // Find or create receipt for this date and payment mode
    const receipt = await findOrCreateReceipt(
      schoolId,
      financialYear,
      normalizedPaymentDate,
      paymentMode,
      session
    );

    // Update receipt with the new payment
    const updatedReceipt = await updateReceiptWithFeePayment(
      receipt,
      feeLedger,
      paymentMethodLedger,
      finalAmount,
      session
    );

    // ===== UPDATE OPENING CLOSING BALANCE =====
    const ledgerIdsToUpdate = await updateOpeningClosingForFeePayment(
      schoolId,
      financialYear,
      updatedReceipt,
      feeLedger,
      paymentMethodLedger,
      finalAmount,
      session
    );

    // Recalculate all ledgers that were updated
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(
        schoolId,
        financialYear,
        ledgerId,
        session
      );

      await recalculateAllBalancesAfterDate(
        schoolId,
        financialYear,
        ledgerId,
        updatedReceipt.entryDate,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Payment successfully added to receipt and opening balance.",
      data: {
        receiptId: updatedReceipt._id,
        receiptVoucherNumber: updatedReceipt.receiptVoucherNumber,
        totalAmount: updatedReceipt.totalAmount,
        itemDetails: updatedReceipt.itemDetails,
        entryDate: updatedReceipt.entryDate, // This will now be normalized
        receiptDate: updatedReceipt.receiptDate, // This will now be normalized
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error adding payment to receipt:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
      error: error.message,
    });
  }
}

export default addInReceiptForFees;
