import mongoose from "mongoose";
import moment from "moment";
import PaymentEntry from "../../../models/PaymentEntry.js";
import PaymentEntryValidator from "../../../validators/PaymentEntryValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

async function generatePaymentVoucherNumber(schoolId, academicYear) {
  const count = await PaymentEntry.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `PVN/${academicYear}/${nextNumber}`;
}

async function generateTransactionNumber() {
  const now = moment();
  const dateTimeStr = now.format("DDMMYYYYHHmmss");
  let baseTransactionNumber = `TRA-${dateTimeStr}`;
  let transactionNumber = baseTransactionNumber;
  let counter = 1;

  while (await PaymentEntry.exists({ transactionNumber })) {
    const suffix = String(counter).padStart(2, "0");
    transactionNumber = `${baseTransactionNumber}${suffix}`;
    counter++;
  }

  return transactionNumber;
}

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
  paymentEntryId,
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

  // Find the latest balance before the entry date
  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) <= new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  let effectiveOpeningBalance = openingBalance;
  if (previousBalanceDetails.length > 0) {
    effectiveOpeningBalance = previousBalanceDetails[0].closingBalance;
  }

  // Calculate closing balance
  let closingBalance;
  if (balanceType === "Debit") {
    closingBalance = effectiveOpeningBalance + debitAmount - creditAmount;
  } else {
    closingBalance = effectiveOpeningBalance + debitAmount - creditAmount;
  }

  // Check if entry already exists for this payment entry
  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) => detail.entryId?.toString() === paymentEntryId.toString()
  );

  if (existingEntryIndex !== -1) {
    // Update existing entry
    record.balanceDetails[existingEntryIndex] = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: paymentEntryId,
    };
  } else {
    // Create new entry
    const newBalanceDetail = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: paymentEntryId,
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

  // Sort all entries by date, then by _id for consistent same-day order
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  // Find the initial opening balance
  let currentBalance = record.balanceDetails[0].openingBalance;

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = detail.openingBalance;
    } else {
      // Update opening balance to previous closing balance
      detail.openingBalance = record.balanceDetails[i - 1].closingBalance;
      currentBalance = detail.openingBalance;
    }

    // Calculate new closing balance
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

  // Find the index of the first entry after the specified date
  const startIndex = record.balanceDetails.findIndex(
    (detail) => new Date(detail.entryDate) > new Date(date)
  );

  if (startIndex === -1) {
    return; // No entries after this date
  }

  // Get the balance just before the start index
  const previousBalance =
    startIndex > 0
      ? record.balanceDetails[startIndex - 1].closingBalance
      : record.balanceDetails[0].openingBalance;

  let currentBalance = previousBalance;

  // Recalculate all balances from the start index onward
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

async function create(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const { error } = PaymentEntryValidator.PaymentEntryValidator.validate(
      req.body
    );
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

    const {
      vendorCode,
      vendorId,
      entryDate,
      invoiceDate,
      invoiceNumber,
      poNumber,
      dueDate,
      narration,
      paymentMode,
      chequeNumber,
      itemDetails,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      status,
      totalAmountAfterGST,
      TDSTCSRateWithAmountBeforeGST,
      ledgerIdWithPaymentMode,
      academicYear,
    } = req.body;

    const paymentVoucherNumber = await generatePaymentVoucherNumber(
      schoolId,
      academicYear
    );

    const { invoiceImage, chequeImage } = req.files || {};

    const invoiceImageFullPath = invoiceImage?.[0]
      ? `${
          invoiceImage[0].mimetype.startsWith("image/")
            ? "/Images/FinanceModule/InvoiceImage"
            : "/Documents/FinanceModule/InvoiceImage"
        }/${invoiceImage[0].filename}`
      : null;

    const chequeImageFullPath = chequeImage?.[0]
      ? `${
          chequeImage[0].mimetype.startsWith("image/")
            ? "/Images/FinanceModule/ChequeImage"
            : "/Documents/FinanceModule/ChequeImage"
        }/${chequeImage[0].filename}`
      : null;

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amountBeforeGST: parseFloat(item.amountBeforeGST) || 0,
      GSTAmount: parseFloat(item.GSTAmount) || 0,
      amountAfterGST:
        (parseFloat(item.amountBeforeGST) || 0) +
        (parseFloat(item.GSTAmount) || 0),
    }));

    const totalAmountBeforeGST = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amountBeforeGST) || 0),
      0
    );

    const totalGSTAmount = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.GSTAmount) || 0),
      0
    );

    const subTotalAmountAfterGST = updatedItemDetails.reduce(
      (sum, item) => sum + (parseFloat(item.amountAfterGST) || 0),
      0
    );

    const transactionNumber =
      paymentMode === "Online" ? await generateTransactionNumber() : null;

    const newPaymentEntry = new PaymentEntry({
      schoolId,
      paymentVoucherNumber,
      vendorCode,
      vendorId,
      entryDate,
      invoiceDate,
      invoiceNumber,
      poNumber,
      dueDate,
      narration,
      paymentMode,
      chequeNumber,
      transactionNumber,
      itemDetails: updatedItemDetails,
      subTotalAmountAfterGST,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      TDSTCSRateWithAmountBeforeGST,
      totalAmountBeforeGST,
      totalGSTAmount,
      totalAmountAfterGST,
      invoiceImage: invoiceImageFullPath,
      chequeImage: chequeImageFullPath,
      ledgerIdWithPaymentMode,
      status,
      academicYear,
    });

    await newPaymentEntry.save({ session });

    // Store all ledger IDs that need to be updated
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers (Debit) - Aggregate amounts by ledgerId first
    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);

    for (const [ledgerId, totalAmount] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        newPaymentEntry._id,
        totalAmount,
        0
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // 2. TDS/TCS Ledger
    let tdsTcsLedgerId = null;
    const tdsTcsAmount = Number(TDSTCSRateWithAmountBeforeGST) || 0;

    if (TDSorTCS && tdsTcsAmount > 0) {
      // First try exact match (case insensitive)
      let tdsTcsGroupLedger = await GroupLedger.findOne({
        schoolId,
        academicYear,
        groupLedgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
      });

      // If not found, try partial match
      if (!tdsTcsGroupLedger) {
        tdsTcsGroupLedger = await GroupLedger.findOne({
          schoolId,
          academicYear,
          groupLedgerName: { $regex: new RegExp(TDSorTCS, "i") },
        });
      }

      if (!tdsTcsGroupLedger) {
        throw new Error(
          `${TDSorTCS} GroupLedger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      // Find the ledger with exact match first
      let tdsTcsLedgerToUpdate = await Ledger.findOne({
        schoolId,
        academicYear,
        groupLedgerId: tdsTcsGroupLedger._id,
        ledgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
      });

      // If not found, get any ledger in this group
      if (!tdsTcsLedgerToUpdate) {
        tdsTcsLedgerToUpdate = await Ledger.findOne({
          schoolId,
          academicYear,
          groupLedgerId: tdsTcsGroupLedger._id,
        });
      }

      if (!tdsTcsLedgerToUpdate) {
        throw new Error(
          `${TDSorTCS} Ledger not found for GroupLedger ID ${tdsTcsGroupLedger._id}, school ${schoolId} and academic year ${academicYear}`
        );
      }

      tdsTcsLedgerId = tdsTcsLedgerToUpdate._id.toString();

      if (TDSorTCS === "TDS") {
        // For TDS: Debit the TDS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          tdsTcsLedgerId,
          entryDate,
          newPaymentEntry._id,
          0, // debit
          tdsTcsAmount // credit
        );
      } else if (TDSorTCS === "TCS") {
        // For TCS: Credit the TCS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          tdsTcsLedgerId,
          entryDate,
          newPaymentEntry._id,
          tdsTcsAmount, // debit
          0 // credit
        );
      }

      ledgerIdsToUpdate.add(tdsTcsLedgerId);
    }

    // 3. Payment Mode Ledger (Credit)
    let paymentAmount;
    if (TDSorTCS === "TDS") {
      paymentAmount = subTotalAmountAfterGST - tdsTcsAmount;
    } else if (TDSorTCS === "TCS") {
      paymentAmount = subTotalAmountAfterGST + tdsTcsAmount;
    } else {
      paymentAmount = subTotalAmountAfterGST;
    }

    await updateOpeningClosingBalance(
      schoolId,
      academicYear,
      ledgerIdWithPaymentMode,
      entryDate,
      newPaymentEntry._id,
      0, // debit
      paymentAmount // credit
    );
    ledgerIdsToUpdate.add(ledgerIdWithPaymentMode.toString());

    // --- Recalculate all ledgers that were updated ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(schoolId, academicYear, ledgerId);

      // Also recalculate all entries after this date to handle backdated entries
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      hasError: false,
      message: "Payment Entry created successfully!",
      data: newPaymentEntry,
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
        message: `Duplicate entry for ${field}. Payment Entry already exists.`,
      });
    }

    console.error("Error creating Payment Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
