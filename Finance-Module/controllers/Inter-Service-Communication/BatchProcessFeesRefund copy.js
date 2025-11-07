// Finance-Module/controllers/Inter-Service-Communication/BatchProcessFeesRefund.js
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
  session,
  preGeneratedVoucherNumber = null
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

async function updateReceiptWithFeeRefund(
  receipt,
  feeLedger,
  paymentMethodLedger,
  refundAmount,
  session
) {
  const entryDate = receipt.entryDate;

  const existingFeeItemIndex = receipt.itemDetails.findIndex(
    (item) => item.ledgerId.toString() === feeLedger._id.toString()
  );

  const existingPaymentItemIndex = receipt.itemDetails.findIndex(
    (item) => item.ledgerId.toString() === paymentMethodLedger._id.toString()
  );

  // For refunds: Fee ledger gets DEBIT, Payment method gets CREDIT
  if (existingFeeItemIndex !== -1) {
    receipt.itemDetails[existingFeeItemIndex].debitAmount = toTwoDecimals(
      receipt.itemDetails[existingFeeItemIndex].debitAmount + refundAmount
    );
  } else {
    receipt.itemDetails.push({
      itemName: "",
      ledgerId: feeLedger._id.toString(),
      amount: 0,
      debitAmount: toTwoDecimals(refundAmount),
    });
  }

  if (existingPaymentItemIndex !== -1) {
    receipt.itemDetails[existingPaymentItemIndex].amount = toTwoDecimals(
      receipt.itemDetails[existingPaymentItemIndex].amount + refundAmount
    );
  } else {
    receipt.itemDetails.push({
      itemName: "",
      ledgerId: paymentMethodLedger._id.toString(),
      amount: toTwoDecimals(refundAmount),
      debitAmount: 0,
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

async function updateOpeningClosingForFeeRefund(
  schoolId,
  financialYear,
  receipt,
  feeLedger,
  paymentMethodLedger,
  refundAmount,
  session
) {
  const entryDate = receipt.entryDate;
  const receiptEntryId = receipt._id;

  // Store all ledger IDs that need to be updated
  const ledgerIdsToUpdate = new Set();

  // ===== 1. Update Fee Ledger (Income Account) =====
  // For refunds: DEBIT the income account (reducing income)
  let feeDebitAmount = refundAmount;
  let feeCreditAmount = 0;

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
  // For refunds: CREDIT the asset account (money going out)
  let paymentMethodDebitAmount = 0;
  let paymentMethodCreditAmount = refundAmount;

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

  // REFUND LOGIC (Opposite of payment)
  // Net Surplus/(Deficit): CREDIT (reducing surplus/increasing deficit)
  netSurplusCreditAmount = refundAmount;
  // Capital Fund: DEBIT (reducing capital fund)
  capitalFundDebitAmount = refundAmount;

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

async function processBatchRefundForDate(
  schoolId,
  financialYear,
  processDate,
  refundsData
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log(
      `Processing ${refundsData.length} refunds for date: ${processDate}`
    );

    // Group refunds by paymentMode and date for receipt creation
    const refundsByMode = {};

    refundsData.forEach((refund) => {
      const key = `${refund.paymentMode}_${refund.refundDate}`;
      if (!refundsByMode[key]) {
        refundsByMode[key] = [];
      }
      refundsByMode[key].push(refund);
    });

    const allLedgerIdsToUpdate = new Set();

    // Get the number of groups that will need new receipts
    const groupKeys = Object.keys(refundsByMode);

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

    // Process each group (payment mode + date combination)
    for (const [key, refunds] of Object.entries(refundsByMode)) {
      const [paymentMode, refundDate] = key.split("_");

      // Get the first refund to use for receipt creation
      const firstRefund = refunds[0];

      // Find or create receipt for this date and payment mode
      const receipt = await findOrCreateReceipt(
        schoolId,
        financialYear,
        new Date(refundDate),
        paymentMode,
        session,
        voucherNumbers[voucherIndex]
      );

      voucherIndex++;

      // Process all refunds for this group
      for (const refund of refunds) {
        const feeLedger = await getFeeLedger(
          schoolId,
          financialYear,
          refund.feeType,
          session
        );

        const paymentMethodLedger = await getPaymentMethodLedger(
          schoolId,
          financialYear,
          refund.paymentMode,
          session
        );

        // Update receipt with this REFUND (using refund-specific function)
        const updatedReceipt = await updateReceiptWithFeeRefund(
          receipt,
          feeLedger,
          paymentMethodLedger,
          refund.refundAmount,
          session
        );

        // Update opening closing balance for REFUND
        const ledgerIdsToUpdate = await updateOpeningClosingForFeeRefund(
          schoolId,
          financialYear,
          updatedReceipt,
          feeLedger,
          paymentMethodLedger,
          refund.refundAmount,
          session
        );

        ledgerIdsToUpdate.forEach((id) => allLedgerIdsToUpdate.add(id));
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
      message: `Successfully processed ${refundsData.length} refunds`,
      processedCount: refundsData.length,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

async function batchProcessFeesRefund(req, res) {
  console.log("============== batchProcessFeesRefund CALLED ================");

  try {
    const { schoolId, financialYear, processDate } = req.body;

    if (!schoolId || !financialYear || !processDate) {
      return res.status(400).json({
        hasError: true,
        message:
          "Missing required fields: schoolId, financialYear, processDate",
      });
    }

    const { refundsData } = req.body;

    if (!refundsData || !Array.isArray(refundsData)) {
      return res.status(400).json({
        hasError: true,
        message: "refundsData array is required",
      });
    }

    const result = await processBatchRefundForDate(
      schoolId,
      financialYear,
      new Date(processDate),
      refundsData
    );

    return res.status(200).json({
      hasError: false,
      ...result,
    });
  } catch (error) {
    console.error("Error in batch refund processing:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error during batch refund processing",
      error: error.message,
    });
  }
}

export default batchProcessFeesRefund;

// example payment entry
// _id
// 690dc8482a9c39c2eda11eaf
// schoolId
// "SID144732"
// financialYear
// "2025-2026"
// receiptVoucherNumber
// "RVN/2025-2026/1"
// customizeEntry
// true
// entryDate
// 2025-11-07T00:00:00.000+00:00
// receiptDate
// 2025-11-07T00:00:00.000+00:00
// narration
// "Auto-generated from Fees Module"

// itemDetails
// Array (2)

// 0
// Object
// itemName
// ""
// ledgerId
// "690b3375fd990fcc0f997768"
// amount
// 1000
// debitAmount
// 0
// _id
// 690dc8482a9c39c2eda11eb3

// 1
// Object
// itemName
// ""
// ledgerId
// "690b3375fd990fcc0f997764"
// amount
// 0
// debitAmount
// 1000
// _id
// 690dc8482a9c39c2eda11eb4
// subTotalAmount
// 1000
// subTotalOfDebit
// 1000
// totalAmount
// 1000
// totalDebitAmount
// 1000
// status
// "Posted"
// approvalStatus
// "Pending"
// sourceModule
// "Fees"
// createdAt
// 2025-11-07T10:22:00.258+00:00
// updatedAt
// 2025-11-07T10:24:00.286+00:00
// __v
// 1

// if entry for refund then

// _id
// 690dc8482a9c39c2eda11eaf
// schoolId
// "SID144732"
// financialYear
// "2025-2026"
// receiptVoucherNumber
// "RVN/2025-2026/1"
// customizeEntry
// true
// entryDate
// 2025-11-07T00:00:00.000+00:00
// receiptDate
// 2025-11-07T00:00:00.000+00:00
// narration
// "Auto-generated from Fees Module"

// itemDetails
// Array (2)

// 0
// Object
// itemName
// ""
// ledgerId
// "690b3375fd990fcc0f997769"
// amount
// 0
// debitAmount
// 1000
// _id
// 690dc8482a9c39c2eda11eb3

// 1
// Object
// itemName
// ""
// ledgerId
// "690b3375fd990fcc0f997764"
// amount
// 1000
// debitAmount
// 0
// _id
// 690dc8482a9c39c2eda11eb4
// subTotalAmount
// 1000
// subTotalOfDebit
// 1000
// totalAmount
// 1000
// totalDebitAmount
// 1000
// status
// "Posted"
// approvalStatus
// "Pending"
// sourceModule
// "Fees"
// createdAt
// 2025-11-07T10:22:00.258+00:00
// updatedAt
// 2025-11-07T10:24:00.286+00:00
// __v
// 1

// but currently you are doing below thing which is wrong see

// see for example if i cancell anything in bank check book then it pass new entry not to cancell out things
// not updating it....right? just like that you need to pass new entry to cancel not uodate in existing one so do it for me

// _id
// 690dc8482a9c39c2eda11eaf
// schoolId
// "SID144732"
// financialYear
// "2025-2026"
// receiptVoucherNumber
// "RVN/2025-2026/1"
// customizeEntry
// true
// entryDate
// 2025-11-07T00:00:00.000+00:00
// receiptDate
// 2025-11-07T00:00:00.000+00:00
// narration
// "Auto-generated from Fees Module"

// itemDetails
// Array (2)

// 0
// Object
// itemName
// ""
// ledgerId
// "690b3375fd990fcc0f997768"
// amount
// 1000
// debitAmount
// 1000
// _id
// 690dc8482a9c39c2eda11eb3

// 1
// Object
// itemName
// ""
// ledgerId
// "690b3375fd990fcc0f997764"
// amount
// 1000
// debitAmount
// 1000
// _id
// 690dc8482a9c39c2eda11eb4
// subTotalAmount
// 2000
// subTotalOfDebit
// 2000
// totalAmount
// 2000
// totalDebitAmount
// 2000
// status
// "Posted"
// approvalStatus
// "Pending"
// sourceModule
// "Fees"
// createdAt
// 2025-11-07T10:22:00.258+00:00
// updatedAt
// 2025-11-07T10:24:00.286+00:00
// __v
// 1
