import mongoose from "mongoose";
import Receipt from "../../../models/Receipt.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

async function removeReceiptFromLedger(
  schoolId,
  academicYear,
  receiptId,
  ledgerId,
  session
) {
  // Find the record
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session);

  if (!record) return;

  // Remove the entry from balanceDetails
  const originalLength = record.balanceDetails.length;
  record.balanceDetails = record.balanceDetails.filter(
    (detail) => detail.entryId?.toString() !== receiptId.toString()
  );

  if (record.balanceDetails.length === originalLength) return; // nothing removed

  // Sort the remaining entries by date and sequence
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Recalculate sequences for same-day entries
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

  // Re-sort after sequence correction
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Recalculate opening and closing balances
  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    if (i === 0) {
      // First entry uses ledger opening balance
      const ledger = await Ledger.findById(ledgerId).session(session);
      detail.openingBalance = ledger?.openingBalance || 0;
    } else {
      detail.openingBalance = record.balanceDetails[i - 1].closingBalance;
    }
    detail.closingBalance =
      detail.openingBalance + detail.debit - detail.credit;
  }

  await record.save({ session });
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

  // Sort by date and entrySequence
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Ensure sequences are continuous and properly ordered
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

  // Re-sort after sequence correction
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  // Now recalculate balances
  let currentBalance = record.balanceDetails[0].openingBalance;

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = detail.openingBalance;
    } else {
      const previousDetail = record.balanceDetails[i - 1];
      const currentDate = new Date(detail.entryDate).toDateString();
      const previousDate = new Date(previousDetail.entryDate).toDateString();

      if (
        currentDate !== previousDate ||
        detail.entrySequence - previousDetail.entrySequence === 1
      ) {
        detail.openingBalance = previousDetail.closingBalance;
      }
      currentBalance = detail.openingBalance;
    }

    detail.closingBalance = currentBalance + detail.debit - detail.credit;
    currentBalance = detail.closingBalance;
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

  // Sort by date and entrySequence
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

  const previousBalance =
    startIndex > 0
      ? record.balanceDetails[startIndex - 1].closingBalance
      : record.balanceDetails[0].openingBalance;

  let currentBalance = previousBalance;

  for (let i = startIndex; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    detail.openingBalance = currentBalance;
    detail.closingBalance = currentBalance + detail.debit - detail.credit;
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

    // Find the payment entry with all details
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
        message: "Receipt entry not found.",
      });
    }

    // Store all ledger IDs that were affected by this payment
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers (from itemDetails)
    const itemLedgerIds = existingReceipt.itemDetails
      .map((item) => item.ledgerId?.toString())
      .filter((id) => id);

    itemLedgerIds.forEach((id) => ledgerIdsToUpdate.add(id));

    // 2. Receipt Mode Ledger
    if (existingReceipt.ledgerIdWithPaymentMode) {
      ledgerIdsToUpdate.add(existingReceipt.ledgerIdWithPaymentMode.toString());
    }

    // 3. TDS/TCS Ledger (if applicable)
    if (existingReceipt.TDSorTCSLedgerId) {
      ledgerIdsToUpdate.add(existingReceipt.TDSorTCSLedgerId.toString());
    }

    // --- Step A: Remove payment entry from all affected ledgers ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await removeReceiptFromLedger(
        schoolId,
        academicYear,
        existingReceipt._id,
        ledgerId,
        session
      );
    }

    // --- Step B: Update payment status to "Cancelled" ---
    existingReceipt.status = "Cancelled";
    await existingReceipt.save({ session });

    // --- Step C: Recalculate all affected ledgers ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        ledgerId,
        session
      );

      // Also recalculate balances after the entry date to handle sequencing
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        existingReceipt.entryDate,
        session
      );
    }

    // ========== NEW CODE: Remove data from TotalNetdeficitNetSurplus table ==========

    // Find the TotalNetdeficitNetSurplus record
    let totalNetRecord = await TotalNetdeficitNetSurplus.findOne({
      schoolId,
      academicYear,
    }).session(session);

    if (totalNetRecord) {
      // Remove the entry for this payment
      const originalLength = totalNetRecord.balanceDetails.length;
      totalNetRecord.balanceDetails = totalNetRecord.balanceDetails.filter(
        (detail) => detail.entryId?.toString() !== id.toString()
      );

      // Only save if something was actually removed
      if (totalNetRecord.balanceDetails.length !== originalLength) {
        // Sort balanceDetails by date
        totalNetRecord.balanceDetails.sort(
          (a, b) => new Date(a.entryDate) - new Date(b.entryDate)
        );

        await totalNetRecord.save({ session });
      }
    }

    // ========== END OF NEW CODE ==========

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "Receipt entry cancelled successfully!",
      data: existingReceipt,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error cancelling Receipt Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}
export default cancelById;
