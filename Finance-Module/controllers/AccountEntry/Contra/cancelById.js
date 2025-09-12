import mongoose from "mongoose";
import Contra from "../../../models/Contra.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

// Helper function to remove contra entry from balances
async function removeContraEntryFromBalances(
  schoolId,
  academicYear,
  contraEntryId,
  session = null
) {
  // Find all OpeningClosingBalance records that have this contra entry
  const balanceRecords = await OpeningClosingBalance.find({
    schoolId,
    academicYear,
    "balanceDetails.entryId": contraEntryId,
  }).session(session || null);

  for (const record of balanceRecords) {
    // Remove the entry from balance details
    record.balanceDetails = record.balanceDetails.filter(
      (detail) => detail.entryId?.toString() !== contraEntryId.toString()
    );

    await record.save({ session });
  }
}

// Helper function to aggregate amounts by ledgerId for contra entries
function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const debitAmount = parseFloat(item.debitAmount) || 0;
    const creditAmount = parseFloat(item.creditAmount) || 0;

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

// Helper function to aggregate cash account amounts
function aggregateCashAccountAmounts(itemDetails) {
  const cashAccountMap = new Map();

  itemDetails.forEach((item) => {
    if (item.ledgerIdOfCashAccount) {
      const cashAccountId = item.ledgerIdOfCashAccount.toString();
      const debitAmount = parseFloat(item.debitAmount) || 0;
      const creditAmount = parseFloat(item.creditAmount) || 0;

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

// Helper function to find TDS/TCS ledger
async function findTDSorTCSLedger(
  schoolId,
  academicYear,
  TDSorTCS,
  session = null
) {
  if (!TDSorTCS) return null;

  let tdsTcsGroupLedger = await GroupLedger.findOne({
    schoolId,
    academicYear,
    groupLedgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
  }).session(session || null);

  if (!tdsTcsGroupLedger) {
    tdsTcsGroupLedger = await GroupLedger.findOne({
      schoolId,
      academicYear,
      groupLedgerName: { $regex: new RegExp(TDSorTCS, "i") },
    }).session(session || null);
  }

  if (!tdsTcsGroupLedger) {
    return null;
  }

  let tdsTcsLedger = await Ledger.findOne({
    schoolId,
    academicYear,
    groupLedgerId: tdsTcsGroupLedger._id,
    ledgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
  }).session(session || null);

  if (!tdsTcsLedger) {
    tdsTcsLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      groupLedgerId: tdsTcsGroupLedger._id,
    }).session(session || null);
  }

  return tdsTcsLedger;
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

// Helper function to recalculate all affected ledgers for contra entries
async function recalculateAllAffectedLedgers(
  schoolId,
  academicYear,
  itemDetails,
  contraEntryName,
  TDSorTCS,
  TDSTCSRateAmount,
  session = null
) {
  // Store all ledger IDs that need to be recalculated
  const ledgerIdsToRecalculate = new Set();

  // 1. Add main ledgers from item details
  const ledgerAmounts = aggregateAmountsByLedger(itemDetails);
  for (const [ledgerId] of ledgerAmounts) {
    ledgerIdsToRecalculate.add(ledgerId);
  }

  // 2. Add cash account ledgers if applicable
  if (["Cash Deposited", "Cash Withdrawn", ""].includes(contraEntryName)) {
    const cashAccountAmounts = aggregateCashAccountAmounts(itemDetails);
    for (const [cashAccountId] of cashAccountAmounts) {
      ledgerIdsToRecalculate.add(cashAccountId);
    }
  }

  // 3. Add TDS/TCS ledger if applicable
  if (TDSorTCS && TDSTCSRateAmount > 0) {
    const tdsTcsLedger = await findTDSorTCSLedger(
      schoolId,
      academicYear,
      TDSorTCS,
      session
    );
    if (tdsTcsLedger) {
      ledgerIdsToRecalculate.add(tdsTcsLedger._id.toString());
    }
  }

  // Recalculate balances for all affected ledgers
  for (const ledgerId of ledgerIdsToRecalculate) {
    await recalculateLedgerBalances(schoolId, academicYear, ledgerId, session);
  }
}

async function cancelById(req, res) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const schoolId = req.user?.schoolId;
      const { id, academicYear } = req.params;

      if (!schoolId) {
        throw new Error("Access denied: Unauthorized request.");
      }

      // Find the contra entry with all details
      const existingContra = await Contra.findOne({
        _id: id,
        schoolId,
        academicYear,
      }).session(session);

      if (!existingContra) {
        throw new Error("Contra not found.");
      }

      // Check if already cancelled
      if (existingContra.status === "Cancelled") {
        throw new Error("Contra is already cancelled.");
      }

      // Store the entry details before cancellation for balance recalculation
      const itemDetails = existingContra.itemDetails;
      const contraEntryName = existingContra.contraEntryName;
      const TDSorTCS = existingContra.TDSorTCS;
      const TDSTCSRateAmount = existingContra.TDSTCSRateAmount || 0;

      // Update status to "Cancelled"
      existingContra.status = "Cancelled";
      await existingContra.save({ session });

      // Remove this contra entry from all OpeningClosingBalance records
      await removeContraEntryFromBalances(
        schoolId,
        academicYear,
        existingContra._id,
        session
      );

      // Recalculate balances for all affected ledgers
      await recalculateAllAffectedLedgers(
        schoolId,
        academicYear,
        itemDetails,
        contraEntryName,
        TDSorTCS,
        TDSTCSRateAmount,
        session
      );

      return res.status(200).json({
        hasError: false,
        message: "Contra cancelled successfully.",
        data: existingContra,
      });
    });
  } catch (error) {
    console.error("Error cancelling Contra:", error);

    // Handle specific error types
    if (
      error.message.includes("Access denied") ||
      error.message.includes("Contra not found") ||
      error.message.includes("already cancelled")
    ) {
      return res.status(400).json({
        hasError: true,
        message: error.message,
      });
    }

    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  } finally {
    // Always end the session, regardless of success or failure
    await session.endSession();
  }
}

export default cancelById;
