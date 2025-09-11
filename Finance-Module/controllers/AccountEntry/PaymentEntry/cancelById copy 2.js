import mongoose from "mongoose";

import PaymentEntry from "../../../models/PaymentEntry.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";

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

    // Recalculate balances for this ledger
    await recalculateLedgerBalances(
      schoolId,
      academicYear,
      record.ledgerId,
      session
    );
  }
}

// Helper function to recalculate ledger balances
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

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  let currentBalance = record.balanceDetails[0].openingBalance;

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = detail.openingBalance;
    } else {
      detail.openingBalance = record.balanceDetails[i - 1].closingBalance;
      currentBalance = detail.openingBalance;
    }

    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save({ session });
}

async function deleteById(req, res) {
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

    // Find the payment entry
    const paymentEntry = await PaymentEntry.findOne({
      _id: id,
      schoolId,
      academicYear,
    }).session(session);

    if (!paymentEntry) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        hasError: true,
        message: "PaymentEntry not found.",
      });
    }

    // Update status to "Cancelled" instead of deleting
    paymentEntry.status = "Cancelled";
    await paymentEntry.save({ session });

    // Remove this payment entry from all OpeningClosingBalance records
    await removePaymentEntryFromBalances(
      schoolId,
      academicYear,
      paymentEntry._id,
      session
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "PaymentEntry cancelled successfully.",
      data: paymentEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error cancelling PaymentEntry:", error);
    return res.status(500).json({
      hasError: true,
      message:
        error.message || "Internal server error while cancelling PaymentEntry.",
    });
  }
}

export default deleteById;
