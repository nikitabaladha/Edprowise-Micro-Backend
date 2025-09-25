// see for example if i have 2 entries on same date like 24-09-2025

// enrty     HeadofAccount	BS&P&LLedger	       GroupLedger	Ledger	      OpeningBalance  Debit	Credit Closing Balance
// entry-1.  Liabilities	  Current Liabilities	 TDS Payable	TDS Deducted. -1000.          5.     0.     -995
// entry-2.  Liabilities	  Current Liabilities	 TDS Payable	TDS Deducted. -995.           5.     0.     -990

// then if i remove TDS from entry-1 then from opening Closing Balance table also it must remove that perticular entry for TDS
// and for another entry like for entry-2 now can have opening balance of previous one like

// enrty     HeadofAccount	BS&P&LLedger	       GroupLedger	Ledger	      OpeningBalance  Debit	Credit Closing Balance
// entry-2.  Liabilities	  Current Liabilities	 TDS Payable	TDS Deducted. -1000.          5.     0.      -995

// but here it is not removing the deleted or chnaged ledger and stores as it is
// enrty     HeadofAccount	BS&P&LLedger	       GroupLedger	Ledger	      OpeningBalance  Debit	Credit Closing Balance
// entry-1.  Liabilities	  Current Liabilities	 TDS Payable	TDS Deducted. -1000.          5.     0.     -995
// entry-2.  Liabilities	  Current Liabilities	 TDS Payable	TDS Deducted. -995.           5.     0.     -990

// why why why?

// previously when not upadted

// _id
// 68d380433af7b4222d5aea30
// schoolId
// "SID144732"
// academicYear
// "2025-2026"
// ledgerId
// 68d0c4ecde919f0bb143b7f9

// balanceDetails
// Array (2)

// 0
// Object
// entryId
// "68d380423af7b4222d5aea26"
// entryDate
// 2025-09-24T00:00:00.000+00:00
// openingBalance
// -100
// debit
// 5
// credit
// 0
// closingBalance
// -995
// _id
// 68d380a13af7b4222d5aead0

// 1
// Object
// entryId
// "68d3806e3af7b4222d5aea60"
// entryDate
// 2025-09-24T00:00:00.000+00:00
// openingBalance
// -995
// debit
// 5
// credit
// 0
// closingBalance
// -990
// _id
// 68d3806f3af7b4222d5aea6b

// balanceType
// "Credit"
// createdAt
// 2025-09-24T05:23:15.185+00:00
// updatedAt
// 2025-09-24T05:24:49.954+00:00
// __v
// 7;

// after update in entry-1

// _id
// 68d380433af7b4222d5aea30
// schoolId
// "SID144732"
// academicYear
// "2025-2026"
// ledgerId
// 68d0c4ecde919f0bb143b7f9

// balanceDetails
// Array (2)

// 0
// Object
// entryId
// "68d380423af7b4222d5aea26"
// entryDate
// 2025-09-24T00:00:00.000+00:00
// openingBalance
// -100
// debit
// 5
// credit
// 0
// closingBalance
// -995
// _id
// 68d380a13af7b4222d5aead0

// 1
// Object
// entryId
// "68d3806e3af7b4222d5aea60"
// entryDate
// 2025-09-24T00:00:00.000+00:00
// openingBalance
// -995
// debit
// 5
// credit
// 0
// closingBalance
// -990
// _id
// 68d3806f3af7b4222d5aea6b

// balanceType
// "Credit"
// createdAt
// 2025-09-24T05:23:15.185+00:00
// updatedAt
// 2025-09-24T05:24:49.954+00:00
// __v
// 7;

// and it not only for TDSorTCS it must be applicable for item.ledgerId as well as ledgerIdWithPaymentMode also
// but here it gives wrong for all...see if new coming then store new as well do calculation as accoringly  why why why?

import mongoose from "mongoose";
import moment from "moment";
import Receipt from "../../../models/Receipt.js";
import ReceiptValidator from "../../../validators/ReceiptValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

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

// Reuse the same helper functions from your create API
async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate
) {
  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  });

  let openingBalance = 0;
  let balanceType = "Debit";

  if (ledger) {
    balanceType = ledger.balanceType;
    openingBalance = ledger.openingBalance || 0;
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

async function updateOpeningClosingBalance(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  receiptId,
  debitAmount = 0,
  creditAmount = 0
) {
  debitAmount = Number(debitAmount);
  creditAmount = Number(creditAmount);

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate
    );

  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) <= new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  let effectiveOpeningBalance = openingBalance;
  if (previousBalanceDetails.length > 0) {
    effectiveOpeningBalance = previousBalanceDetails[0].closingBalance;
  }

  let closingBalance;
  if (balanceType === "Debit") {
    closingBalance = effectiveOpeningBalance + debitAmount - creditAmount;
  } else {
    closingBalance = effectiveOpeningBalance + debitAmount - creditAmount;
  }

  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) =>
      new Date(detail.entryDate).getTime() === new Date(entryDate).getTime() &&
      detail.entryId?.toString() === receiptId.toString()
  );

  if (existingEntryIndex !== -1) {
    record.balanceDetails[existingEntryIndex] = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: receiptId,
    };
  } else {
    const newBalanceDetail = {
      entryDate,
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
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  await record.save();
  return record;
}

async function recalculateLedgerBalances(schoolId, academicYear, ledgerId) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  });

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  });

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

  await record.save();
}

async function recalculateAllBalancesAfterDate(
  schoolId,
  academicYear,
  ledgerId,
  date
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  });

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
      academicYear,
      _id: ledgerId,
    });

    const balanceType = ledger?.balanceType || "Debit";

    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save();
}

async function removeReceiptFromBalances(
  schoolId,
  academicYear,
  receiptId,
  entryDate
) {
  // Find all OpeningClosingBalance records that have this receipt entry
  const balanceRecords = await OpeningClosingBalance.find({
    schoolId,
    academicYear,
    "balanceDetails.entryId": receiptId,
  });

  for (const record of balanceRecords) {
    // Remove the entry from balance details
    record.balanceDetails = record.balanceDetails.filter(
      (detail) => detail.entryId?.toString() !== receiptId.toString()
    );

    await record.save();

    // Recalculate balances for this ledger
    await recalculateLedgerBalances(schoolId, academicYear, record.ledgerId);
    await recalculateAllBalancesAfterDate(
      schoolId,
      academicYear,
      record.ledgerId,
      entryDate
    );
  }
}

async function findTDSorTCSLedger(schoolId, academicYear, TDSorTCS) {
  if (!TDSorTCS) return null;

  let tdsTcsGroupLedger = await GroupLedger.findOne({
    schoolId,
    academicYear,
    groupLedgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
  });

  if (!tdsTcsGroupLedger) {
    tdsTcsGroupLedger = await GroupLedger.findOne({
      schoolId,
      academicYear,
    });
  }

  if (!tdsTcsGroupLedger) {
    return null;
  }

  let tdsTcsLedger = await Ledger.findOne({
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

function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const amount = parseFloat(item.amount) || 0;

    if (ledgerMap.has(ledgerId)) {
      ledgerMap.set(ledgerId, ledgerMap.get(ledgerId) + amount);
    } else {
      ledgerMap.set(ledgerId, amount);
    }
  });

  return ledgerMap;
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
      amount: parseFloat(item.amount) || 0,
    }));

    const subTotalAmount = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amount) || 0),
      0
    );

    const parsedTDSTCSRateWithAmount = parseFloat(TDSTCSRateWithAmount) || 0;

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

    await existingReceipt.save({ session });

    // Remove old balance entries first
    await removeReceiptFromBalances(
      schoolId,
      academicYear,
      existingReceipt._id,
      oldEntryDate
    );

    // Store all ledger IDs that need to be updated
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers (Credit) - Aggregate amounts by ledgerId
    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);

    // 1. Item Ledgers (Credit)

    for (const [ledgerId, amount] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        existingReceipt._id,
        0,
        amount
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // 2. TDS/TCS Ledger
    let tdsTcsLedgerId = null;
    const tdsTcsAmount = Number(TDSTCSRateWithAmount) || 0;

    if (TDSorTCS && tdsTcsAmount > 0) {
      const tdsTcsLedger = await findTDSorTCSLedger(
        schoolId,
        academicYear,
        TDSorTCS
      );

      if (!tdsTcsLedger) {
        throw new Error(
          `${TDSorTCS} Ledger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      tdsTcsLedgerId = tdsTcsLedger._id.toString();

      if (TDSorTCS === "TDS") {
        // For TDS: Debit the TDS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          tdsTcsLedgerId,
          entryDate,
          existingReceipt._id,
          tdsTcsAmount, // debit
          0 // credit
        );
      } else if (TDSorTCS === "TCS") {
        // For TCS: Credit the TCS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          tdsTcsLedgerId,
          entryDate,
          existingReceipt._id,
          0, // debit
          tdsTcsAmount // credit
        );
      }

      ledgerIdsToUpdate.add(tdsTcsLedgerId);
    }

    // 3. Payment Mode Ledger (Debit)
    let paymentAmount;
    if (TDSorTCS === "TDS") {
      paymentAmount = subTotalAmount - tdsTcsAmount;
    } else if (TDSorTCS === "TCS") {
      paymentAmount = subTotalAmount + tdsTcsAmount;
    } else {
      paymentAmount = subTotalAmount;
    }

    await updateOpeningClosingBalance(
      schoolId,
      academicYear,
      ledgerIdWithPaymentMode,
      entryDate,
      existingReceipt._id,
      paymentAmount, // debit
      0 // credit
    );
    ledgerIdsToUpdate.add(ledgerIdWithPaymentMode.toString());

    // --- Recalculate all ledgers that were updated ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(schoolId, academicYear, ledgerId);
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate
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
    await session.abortTransaction();
    session.endSession();

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
  }
}

export default updateById;
