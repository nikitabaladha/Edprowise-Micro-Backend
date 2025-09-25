import mongoose from "mongoose";
import Receipt from "../../../models/Receipt.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

// Helper function to remove receipt entry from balances
async function removeReceiptEntryFromBalances(
  schoolId,
  academicYear,
  receiptEntryId,
  session = null
) {
  // Find all OpeningClosingBalance records that have this receipt entry
  const balanceRecords = await OpeningClosingBalance.find({
    schoolId,
    academicYear,
    "balanceDetails.entryId": receiptEntryId,
  }).session(session || null);

  for (const record of balanceRecords) {
    // Remove the entry from balance details
    record.balanceDetails = record.balanceDetails.filter(
      (detail) => detail.entryId?.toString() !== receiptEntryId.toString()
    );

    await record.save({ session });
  }
}

// Helper function to aggregate amounts by ledgerId for receipts
function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const amount = parseFloat(item.amount) || 0;
    const debitAmount = parseFloat(item.debitAmount) || 0;

    if (ledgerMap.has(ledgerId)) {
      const existing = ledgerMap.get(ledgerId);
      ledgerMap.set(ledgerId, {
        amount: existing.amount + amount,
        debitAmount: existing.debitAmount + debitAmount,
      });
    } else {
      ledgerMap.set(ledgerId, {
        amount: amount,
        debitAmount: debitAmount,
      });
    }
  });

  return ledgerMap;
}

// Helper function to find TDS/TCS ledger - IMPROVED VERSION
async function findTDSorTCSLedger(schoolId, academicYear, TDSorTCS) {
  if (!TDSorTCS) return null;

  // First try to find using the exact ledger name pattern from your create/update functions
  const ledgerNameToFind =
    TDSorTCS === "TDS" ? "TDS on Receipts" : "TCS on Receipts";

  let tdsTcsLedger = await Ledger.findOne({
    schoolId,
    academicYear,
    ledgerName: { $regex: new RegExp(`^${ledgerNameToFind}$`, "i") },
  });

  if (tdsTcsLedger) {
    return tdsTcsLedger;
  }

  // Fallback to group ledger search if direct ledger not found
  let tdsTcsGroupLedger = await GroupLedger.findOne({
    schoolId,
    academicYear,
    groupLedgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
  });

  if (!tdsTcsGroupLedger) {
    tdsTcsGroupLedger = await GroupLedger.findOne({
      schoolId,
      academicYear,
      groupLedgerName: { $regex: new RegExp(TDSorTCS, "i") },
    });
  }

  if (!tdsTcsGroupLedger) {
    return null;
  }

  // Try to find ledger under the group
  tdsTcsLedger = await Ledger.findOne({
    schoolId,
    academicYear,
    groupLedgerId: tdsTcsGroupLedger._id,
    ledgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
  });

  if (!tdsTcsLedger) {
    tdsTcsLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      groupLedgerId: tdsTcsGroupLedger._id,
    });
  }

  return tdsTcsLedger;
}

// Helper function to recalculate all affected ledgers for receipts
async function recalculateAllAffectedLedgers(
  schoolId,
  academicYear,
  entryDate,
  itemDetails,
  TDSorTCS,
  TDSTCSRateWithAmount,
  subTotalAmount,
  subTotalOfDebit,
  ledgerIdWithPaymentMode,
  TDSorTCSLedgerId, // ADD THIS PARAMETER
  session = null
) {
  // Store all ledger IDs that need to be recalculated
  const ledgerIdsToRecalculate = new Set();

  // 1. Add item ledgers (Credit entries in receipts)
  const ledgerAmounts = aggregateAmountsByLedger(itemDetails);
  for (const [ledgerId] of ledgerAmounts) {
    ledgerIdsToRecalculate.add(ledgerId);
  }

  // 2. Add payment mode ledger (Debit entry in receipts)
  if (ledgerIdWithPaymentMode) {
    ledgerIdsToRecalculate.add(ledgerIdWithPaymentMode.toString());
  }

  // 3. Add TDS/TCS ledger if applicable - IMPROVED LOGIC
  if (TDSorTCS && TDSTCSRateWithAmount > 0) {
    // First try to use the stored TDSorTCSLedgerId from the receipt
    if (TDSorTCSLedgerId) {
      ledgerIdsToRecalculate.add(TDSorTCSLedgerId.toString());
    } else {
      // Fallback to finding the ledger if ID is not stored
      const tdsTcsLedger = await findTDSorTCSLedger(
        schoolId,
        academicYear,
        TDSorTCS
      );
      if (tdsTcsLedger) {
        ledgerIdsToRecalculate.add(tdsTcsLedger._id.toString());
      }
    }
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

    // Find the receipt with all details
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

    // Store the entry details before cancellation for balance recalculation
    const entryDate = existingReceipt.entryDate;
    const itemDetails = existingReceipt.itemDetails;
    const TDSorTCS = existingReceipt.TDSorTCS;
    const TDSTCSRateWithAmount = existingReceipt.TDSTCSRateWithAmount || 0;
    const subTotalAmount = existingReceipt.subTotalAmount || 0;
    const subTotalOfDebit = existingReceipt.subTotalOfDebit || 0;
    const ledgerIdWithPaymentMode = existingReceipt.ledgerIdWithPaymentMode;
    const TDSorTCSLedgerId = existingReceipt.TDSorTCSLedgerId; // GET THE STORED LEDGER ID

    // Update status to "Cancelled"
    existingReceipt.status = "Cancelled";
    await existingReceipt.save({ session });

    // Remove this receipt entry from all OpeningClosingBalance records
    await removeReceiptEntryFromBalances(
      schoolId,
      academicYear,
      existingReceipt._id,
      session
    );

    // Recalculate balances for all affected ledgers (including TDS/TCS)
    await recalculateAllAffectedLedgers(
      schoolId,
      academicYear,
      entryDate,
      itemDetails,
      TDSorTCS,
      TDSTCSRateWithAmount,
      subTotalAmount,
      subTotalOfDebit,
      ledgerIdWithPaymentMode,
      TDSorTCSLedgerId, // PASS THE STORED LEDGER ID
      session
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Receipt cancelled successfully.",
      data: existingReceipt,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error cancelling Receipt:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default cancelById;
