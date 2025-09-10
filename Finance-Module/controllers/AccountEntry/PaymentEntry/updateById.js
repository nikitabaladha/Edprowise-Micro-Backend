import mongoose from "mongoose";
import moment from "moment";
import PaymentEntry from "../../../models/PaymentEntry.js";
import PaymentEntryValidator from "../../../validators/PaymentEntryValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

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
    (detail) => detail.entryId?.toString() === paymentEntryId.toString()
  );

  if (existingEntryIndex !== -1) {
    record.balanceDetails[existingEntryIndex] = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: paymentEntryId,
    };
  } else {
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

async function removePaymentEntryFromBalances(
  schoolId,
  academicYear,
  paymentEntryId
) {
  // Find all OpeningClosingBalance records that have this payment entry
  const balanceRecords = await OpeningClosingBalance.find({
    schoolId,
    academicYear,
    "balanceDetails.entryId": paymentEntryId,
  });

  for (const record of balanceRecords) {
    // Remove the entry from balance details
    record.balanceDetails = record.balanceDetails.filter(
      (detail) => detail.entryId?.toString() !== paymentEntryId.toString()
    );

    await record.save();

    // Recalculate balances for this ledger
    await recalculateLedgerBalances(schoolId, academicYear, record.ledgerId);
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
      groupLedgerName: { $regex: new RegExp(TDSorTCS, "i") },
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

    const { error } =
      PaymentEntryValidator.PaymentEntryValidatorUpdate.validate(req.body);
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
      TDSTCSRateWithAmountBeforeGST,
      ledgerIdWithPaymentMode,
      totalAmountAfterGST,
      status,
    } = req.body;

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

    // Store old values for comparison
    const oldEntryDate = existingPaymentEntry.entryDate;
    const oldItemDetails = existingPaymentEntry.itemDetails;
    const oldTDSorTCS = existingPaymentEntry.TDSorTCS;
    const oldTDSTCSRateWithAmountBeforeGST =
      existingPaymentEntry.TDSTCSRateWithAmountBeforeGST;
    const oldLedgerIdWithPaymentMode =
      existingPaymentEntry.ledgerIdWithPaymentMode;

    // Handle uploaded files
    const { invoiceImage, chequeImage } = req.files || {};

    if (invoiceImage?.[0]) {
      const invoiceImagePath = invoiceImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/InvoiceImage"
        : "/Documents/FinanceModule/InvoiceImage";
      existingPaymentEntry.invoiceImage = `${invoiceImagePath}/${invoiceImage[0].filename}`;
    }

    if (chequeImage?.[0]) {
      const chequeImagePath = chequeImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/ChequeImage"
        : "/Documents/FinanceModule/ChequeImage";
      existingPaymentEntry.chequeImage = `${chequeImagePath}/${chequeImage[0].filename}`;
    }

    // Recalculate item details amounts
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

    const parsedTDSTCSRateWithAmountBeforeGST =
      parseFloat(TDSTCSRateWithAmountBeforeGST) || 0;

    // Update fields
    existingPaymentEntry.vendorCode = vendorCode;
    existingPaymentEntry.vendorId = vendorId;
    existingPaymentEntry.entryDate = entryDate;
    existingPaymentEntry.invoiceDate = invoiceDate;
    existingPaymentEntry.invoiceNumber = invoiceNumber;
    existingPaymentEntry.poNumber = poNumber;
    existingPaymentEntry.dueDate = dueDate;
    existingPaymentEntry.narration = narration;
    existingPaymentEntry.paymentMode = paymentMode;
    existingPaymentEntry.chequeNumber = chequeNumber;
    existingPaymentEntry.itemDetails = updatedItemDetails;
    existingPaymentEntry.TDSorTCS = TDSorTCS;
    existingPaymentEntry.TDSTCSRateChartId = TDSTCSRateChartId;
    existingPaymentEntry.TDSTCSRate = TDSTCSRate;
    existingPaymentEntry.TDSTCSRateWithAmountBeforeGST =
      parsedTDSTCSRateWithAmountBeforeGST;
    existingPaymentEntry.subTotalAmountAfterGST = subTotalAmountAfterGST;
    existingPaymentEntry.totalAmountBeforeGST = totalAmountBeforeGST;
    existingPaymentEntry.totalGSTAmount = totalGSTAmount;
    existingPaymentEntry.totalAmountAfterGST = totalAmountAfterGST;
    existingPaymentEntry.ledgerIdWithPaymentMode = ledgerIdWithPaymentMode;
    existingPaymentEntry.status = status;

    if (paymentMode === "Online" && !existingPaymentEntry.transactionNumber) {
      existingPaymentEntry.transactionNumber =
        await generateTransactionNumber();
    }

    await existingPaymentEntry.save({ session });

    // Remove old balance entries first
    await removePaymentEntryFromBalances(
      schoolId,
      academicYear,
      existingPaymentEntry._id
    );

    // Store all ledger IDs that need to be updated
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers (Debit) - Aggregate amounts by ledgerId
    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);

    for (const [ledgerId, totalAmount] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        existingPaymentEntry._id,
        totalAmount,
        0
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // 2. TDS/TCS Ledger
    let tdsTcsLedgerId = null;
    const tdsTcsAmount = Number(TDSTCSRateWithAmountBeforeGST) || 0;

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
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          tdsTcsLedgerId,
          entryDate,
          existingPaymentEntry._id,
          0,
          tdsTcsAmount
        );
      } else if (TDSorTCS === "TCS") {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          tdsTcsLedgerId,
          entryDate,
          existingPaymentEntry._id,
          tdsTcsAmount,
          0
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
      existingPaymentEntry._id,
      0,
      paymentAmount
    );
    ledgerIdsToUpdate.add(ledgerIdWithPaymentMode);

    // Recalculate balances for all affected ledgers
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(schoolId, academicYear, ledgerId);

      // If entry date changed, recalculate balances after the old date as well
      if (
        oldEntryDate &&
        new Date(entryDate).getTime() !== new Date(oldEntryDate).getTime()
      ) {
        await recalculateAllBalancesAfterDate(
          schoolId,
          academicYear,
          ledgerId,
          oldEntryDate
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      hasError: false,
      message: "PaymentEntry updated successfully.",
      data: existingPaymentEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error updating PaymentEntry:", error);
    return res.status(500).json({
      hasError: true,
      message:
        error.message || "Internal server error while updating PaymentEntry.",
    });
  }
}

export default updateById;
