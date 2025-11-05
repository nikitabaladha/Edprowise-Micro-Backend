// /Users/nikita/Desktop/EDPROWISE_Nikita_FINAL/Edprowise_Backend/Edprowise-Micro-Backend/Finance-Module/controllers/Inter-Service-Communication/addRegistartionPaymentInFinance.js

import mongoose from "mongoose";
import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

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
  let balanceType = "Debit"; // Default for asset accounts like Cash, Bank

  if (ledger) {
    balanceType = ledger.balanceType || "Debit";
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

async function updateOpeningClosingBalanceForRegistration(
  schoolId,
  financialYear,
  ledgerId,
  entryDate,
  entryId,
  debitAmount,
  creditAmount,
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

  // Calculate closing balance
  let closingBalance;
  if (balanceType === "Debit") {
    closingBalance = toTwoDecimals(openingBalance + debitAmount - creditAmount);
  } else {
    closingBalance = toTwoDecimals(openingBalance - debitAmount + creditAmount);
  }

  // Check if exact same entry already exists
  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) =>
      new Date(detail.entryDate).getTime() === new Date(entryDate).getTime() &&
      detail.entryId?.toString() === entryId.toString()
  );

  if (existingEntryIndex !== -1) {
    // Update existing entry
    record.balanceDetails[existingEntryIndex] = {
      entryDate,
      openingBalance: toTwoDecimals(openingBalance),
      debit: toTwoDecimals(debitAmount),
      credit: toTwoDecimals(creditAmount),
      closingBalance: toTwoDecimals(closingBalance),
      entryId,
    };
  } else {
    // Create new entry
    const newBalanceDetail = {
      entryDate,
      openingBalance: toTwoDecimals(openingBalance),
      debit: toTwoDecimals(debitAmount),
      credit: toTwoDecimals(creditAmount),
      closingBalance: toTwoDecimals(closingBalance),
      entryId,
    };

    record.balanceDetails.push(newBalanceDetail);
  }

  // Sort by date
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id?.toString().localeCompare(b._id?.toString());
  });

  await record.save({ session });
  return record;
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

async function addRegistartionPaymentInFinance(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { schoolId, financialYear } = req.query;
    const registrationData = req.body;

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

    // Validate required registration data
    const { paymentId, finalAmount, paymentDate, academicYear, paymentMode } =
      registrationData;

    if (!paymentId || !finalAmount || !paymentDate || !paymentMode) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message:
          "Missing required fields: paymentId, finalAmount, paymentDate, paymentMode",
      });
    }

    // Skip if payment mode is "null"
    if (paymentMode === "null") {
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({
        hasError: false,
        message: "Payment mode is 'null', skipping finance update.",
      });
    }

    // ===== 1. Update Registration Fee Ledger (Income Account) =====
    const registrationFeeLedger = await Ledger.findOne({
      schoolId,
      financialYear,
      ledgerName: "Registration Fee",
    }).session(session);

    if (!registrationFeeLedger) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "Registration Fee ledger not found in the system",
      });
    }

    // ===== 2. Update Payment Method Ledger (Asset Account) =====
    const paymentMethodLedger = await getPaymentMethodLedger(
      schoolId,
      financialYear,
      paymentMode,
      session
    );

    // ===== 3. Get Net Surplus/(Deficit) and Capital Fund Ledgers =====
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

    // ===== Determine amounts for all ledgers based on double-entry accounting =====
    let regFeeDebitAmount = 0;
    let regFeeCreditAmount = 0;
    let paymentMethodDebitAmount = 0;
    let paymentMethodCreditAmount = 0;
    let netSurplusDebitAmount = 0;
    let netSurplusCreditAmount = 0;
    let capitalFundDebitAmount = 0;
    let capitalFundCreditAmount = 0;

    if (finalAmount >= 0) {
      // ===== POSITIVE AMOUNT (Income Received) =====
      // Registration Fee: Credit (Income increases)
      regFeeCreditAmount = finalAmount;

      // Payment Method: Debit (Asset increases)
      paymentMethodDebitAmount = finalAmount;

      // Net Surplus/(Deficit): Debit (opposite of Registration Fee)
      netSurplusDebitAmount = finalAmount;

      // Capital Fund: Credit (same as Registration Fee)
      capitalFundCreditAmount = finalAmount;
    } else {
      // ===== NEGATIVE AMOUNT (Refund Given) =====
      const absAmount = Math.abs(finalAmount);

      // Registration Fee: Debit (Income decreases)
      regFeeDebitAmount = absAmount;

      // Payment Method: Credit (Asset decreases)
      paymentMethodCreditAmount = absAmount;

      // Net Surplus/(Deficit): Credit (opposite of Registration Fee)
      netSurplusCreditAmount = absAmount;

      // Capital Fund: Debit (same as Registration Fee)
      capitalFundDebitAmount = absAmount;
    }

    // ===== Update all ledgers =====

    // 1. Registration Fee Ledger
    await updateOpeningClosingBalanceForRegistration(
      schoolId,
      financialYear,
      registrationFeeLedger._id,
      paymentDate,
      paymentId,
      regFeeDebitAmount,
      regFeeCreditAmount,
      session
    );

    // 2. Payment Method Ledger
    await updateOpeningClosingBalanceForRegistration(
      schoolId,
      financialYear,
      paymentMethodLedger._id,
      paymentDate,
      paymentId,
      paymentMethodDebitAmount,
      paymentMethodCreditAmount,
      session
    );

    // 3. Net Surplus/(Deficit) Ledger
    await updateOpeningClosingBalanceForRegistration(
      schoolId,
      financialYear,
      netSurplusDeficitLedger._id,
      paymentDate,
      paymentId,
      netSurplusDebitAmount,
      netSurplusCreditAmount,
      session
    );

    // 4. Capital Fund Ledger
    await updateOpeningClosingBalanceForRegistration(
      schoolId,
      financialYear,
      capitalFundLedger._id,
      paymentDate,
      paymentId,
      capitalFundDebitAmount,
      capitalFundCreditAmount,
      session
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Registration Payment stored in Finance successfully.",
      data: {
        registrationFeeLedger: {
          ledgerId: registrationFeeLedger._id,
          ledgerName: registrationFeeLedger.ledgerName,
          debit: regFeeDebitAmount,
          credit: regFeeCreditAmount,
        },
        paymentMethodLedger: {
          ledgerId: paymentMethodLedger._id,
          ledgerName: paymentMethodLedger.ledgerName,
          debit: paymentMethodDebitAmount,
          credit: paymentMethodCreditAmount,
        },
        netSurplusDeficitLedger: {
          ledgerId: netSurplusDeficitLedger._id,
          ledgerName: netSurplusDeficitLedger.ledgerName,
          debit: netSurplusDebitAmount,
          credit: netSurplusCreditAmount,
        },
        capitalFundLedger: {
          ledgerId: capitalFundLedger._id,
          ledgerName: capitalFundLedger.ledgerName,
          debit: capitalFundDebitAmount,
          credit: capitalFundCreditAmount,
        },
        finalAmount,
        paymentDate,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error storing Registration Payment in Finance:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
      error: error.message,
    });
  }
}

export default addRegistartionPaymentInFinance;
