import mongoose from "mongoose";
import PaymentEntry from "../../../models/PaymentEntry.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";

async function cancelById(req, res) {
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

    // Find the payment entry with all details
    const existingPaymentEntry = await PaymentEntry.findOne({
      _id: id,
      schoolId,
      academicYear,
    }).session(session);

    if (!existingPaymentEntry) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "PaymentEntry not found.",
      });
    }

    // Store the entry details before cancellation for balance recalculation
    const entryDate = existingPaymentEntry.entryDate;
    const itemDetails = existingPaymentEntry.itemDetails;
    const TDSorTCS = existingPaymentEntry.TDSorTCS;
    const TDSTCSRateWithAmountBeforeGST =
      existingPaymentEntry.TDSTCSRateWithAmountBeforeGST || 0;
    const subTotalAmountAfterGST =
      existingPaymentEntry.subTotalAmountAfterGST || 0;
    const ledgerIdWithPaymentMode =
      existingPaymentEntry.ledgerIdWithPaymentMode;

    // Update status to "Cancelled"
    existingPaymentEntry.status = "Cancelled";
    await existingPaymentEntry.save({ session });

    // Remove this payment entry from all OpeningClosingBalance records
    await removePaymentEntryFromBalances(
      schoolId,
      academicYear,
      existingPaymentEntry._id,
      session
    );

    // Recalculate balances for all affected ledgers
    await recalculateAllAffectedLedgers(
      schoolId,
      academicYear,
      entryDate,
      itemDetails,
      TDSorTCS,
      TDSTCSRateWithAmountBeforeGST,
      subTotalAmountAfterGST,
      ledgerIdWithPaymentMode,
      session
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "PaymentEntry cancelled successfully.",
      data: existingPaymentEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error cancelling PaymentEntry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

// Helper function to remove payment entry from balances
async function removePaymentEntryFromBalances(
  schoolId,
  academicYear,
  paymentEntryId,
  session = null
) {
  // Find all OpeningClosingBalance records that have this payment entry
  const balanceRecords = await OpeningClosingBalance.find({
    schoolId,
    academicYear,
    "balanceDetails.entryId": paymentEntryId,
  }).session(session || null);

  for (const record of balanceRecords) {
    // Remove the entry from balance details
    record.balanceDetails = record.balanceDetails.filter(
      (detail) => detail.entryId?.toString() !== paymentEntryId.toString()
    );

    await record.save({ session });
  }
}

// Helper function to aggregate amounts by ledgerId
function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const amountAfterGST = parseFloat(item.amountAfterGST) || 0;

    if (ledgerMap.has(ledgerId)) {
      ledgerMap.set(ledgerId, ledgerMap.get(ledgerId) + amountAfterGST);
    } else {
      ledgerMap.set(ledgerId, amountAfterGST);
    }
  });

  return ledgerMap;
}

// Helper function to recalculate all affected ledgers
async function recalculateAllAffectedLedgers(
  schoolId,
  academicYear,
  entryDate,
  itemDetails,
  TDSorTCS,
  TDSTCSRateWithAmountBeforeGST,
  subTotalAmountAfterGST,
  ledgerIdWithPaymentMode,
  session = null
) {
  // Store all ledger IDs that need to be recalculated
  const ledgerIdsToRecalculate = new Set();

  // 1. Add item ledgers
  const ledgerAmounts = aggregateAmountsByLedger(itemDetails);
  for (const [ledgerId] of ledgerAmounts) {
    ledgerIdsToRecalculate.add(ledgerId);
  }

  // 2. Add payment mode ledger
  if (ledgerIdWithPaymentMode) {
    ledgerIdsToRecalculate.add(ledgerIdWithPaymentMode.toString());
  }

  // 3. Add TDS/TCS ledger if applicable
  if (TDSorTCS && TDSTCSRateWithAmountBeforeGST > 0) {
    // You might need to implement findTDSorTCSLedger function here
    // or pass the TDS/TCS ledger ID from the original payment entry
    // For now, we'll assume it's handled by the remove function
  }

  // Recalculate balances for all affected ledgers
  for (const ledgerId of ledgerIdsToRecalculate) {
    await recalculateLedgerBalances(schoolId, academicYear, ledgerId, session);
  }
}

// Helper function to recalculate ledger balances from scratch
async function recalculateLedgerBalances(
  schoolId,
  academicYear,
  ledgerId,
  session = null
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session || null);

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session || null);

  const balanceType = ledger?.balanceType || "Debit";

  // Sort all entries by date, then by _id for consistent same-day order
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  // Find the initial opening balance from the ledger
  let currentBalance = ledger?.openingBalance || 0;

  // Process each balance detail in chronological order
  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    // Set the opening balance for this entry
    detail.openingBalance = currentBalance;

    // Calculate the closing balance based on the balance type
    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    // Update current balance for the next entry
    currentBalance = detail.closingBalance;
  }

  await record.save({ session });
}

export default cancelById;
