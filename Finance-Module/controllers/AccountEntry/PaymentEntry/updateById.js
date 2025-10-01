import mongoose from "mongoose";
import moment from "moment";
import PaymentEntry from "../../../models/PaymentEntry.js";
import PaymentEntryValidator from "../../../validators/PaymentEntryValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
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

function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const amountAfterGST = parseFloat(item.amountAfterGST) || 0;

    if (ledgerMap.has(ledgerId)) {
      ledgerMap.set(
        ledgerId,
        toTwoDecimals(ledgerMap.get(ledgerId) + amountAfterGST)
      );
    } else {
      ledgerMap.set(ledgerId, toTwoDecimals(amountAfterGST));
    }
  });

  return ledgerMap;
}

async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  session
) {
  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session);

  let openingBalance = 0;
  let balanceType = "Debit";

  if (ledger) {
    balanceType = ledger.balanceType;
    openingBalance = toTwoDecimals(ledger.openingBalance || 0);
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

  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) < new Date(entryDate))
    .sort((a, b) => {
      const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
      if (dateDiff !== 0) return dateDiff;
      return (a.entrySequence || 0) - (b.entrySequence || 0);
    });

  if (previousBalanceDetails.length > 0) {
    const lastBalanceDetail =
      previousBalanceDetails[previousBalanceDetails.length - 1];
    openingBalance = toTwoDecimals(lastBalanceDetail.closingBalance);
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
  creditAmount = 0,
  session
) {
  debitAmount = toTwoDecimals(Number(debitAmount));
  creditAmount = toTwoDecimals(Number(creditAmount));

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate,
      session
    );

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) => detail.entryId?.toString() === paymentEntryId.toString()
  );

  let entrySequence;

  if (existingEntryIndex !== -1) {
    const existing = record.balanceDetails[existingEntryIndex];
    entrySequence = existing.entrySequence;

    let effectiveOpeningBalance = openingBalance;

    if (existingEntryIndex > 0) {
      effectiveOpeningBalance = toTwoDecimals(
        record.balanceDetails[existingEntryIndex - 1].closingBalance
      );
    } else {
      const entriesBeforeDate = toTwoDecimals(
        record.balanceDetails.filter(
          (detail) => new Date(detail.entryDate) < new Date(entryDate)
        )
      );

      if (entriesBeforeDate.length > 0) {
        entriesBeforeDate.sort((a, b) => {
          const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
          if (dateDiff !== 0) return dateDiff;
          return (a.entrySequence || 0) - (b.entrySequence || 0);
        });
        effectiveOpeningBalance = toTwoDecimals(
          entriesBeforeDate[entriesBeforeDate.length - 1].closingBalance
        );
      } else {
        effectiveOpeningBalance = openingBalance;
      }
    }

    const closingBalance = toTwoDecimals(
      effectiveOpeningBalance + debitAmount - creditAmount
    );

    existing.debit = debitAmount;
    existing.credit = creditAmount;
    existing.entryDate = entryDate;
    existing.openingBalance = effectiveOpeningBalance;
    existing.closingBalance = closingBalance;
  } else {
    const sameDayEntries = record.balanceDetails.filter(
      (d) =>
        new Date(d.entryDate).toDateString() ===
        new Date(entryDate).toDateString()
    );

    entrySequence =
      sameDayEntries.length > 0
        ? Math.max(...sameDayEntries.map((d) => d.entrySequence || 0)) + 1
        : 1;

    let effectiveOpeningBalance = openingBalance;
    const entriesBeforeDate = record.balanceDetails.filter(
      (detail) => new Date(detail.entryDate) < new Date(entryDate)
    );

    if (entriesBeforeDate.length > 0) {
      entriesBeforeDate.sort((a, b) => {
        const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
        if (dateDiff !== 0) return dateDiff;
        return (a.entrySequence || 0) - (b.entrySequence || 0);
      });
      effectiveOpeningBalance = toTwoDecimals(
        entriesBeforeDate[entriesBeforeDate.length - 1].closingBalance
      );
    }

    const closingBalance = toTwoDecimals(
      effectiveOpeningBalance + debitAmount - creditAmount
    );

    const newBalanceDetail = {
      entryDate,
      entrySequence,
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
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  await record.save({ session });
  return record;
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

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

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

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  let currentBalance = toTwoDecimals(record.balanceDetails[0].openingBalance);

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = toTwoDecimals(detail.openingBalance);
    } else {
      const previousDetail = record.balanceDetails[i - 1];

      const currentDate = new Date(detail.entryDate).toDateString();
      const previousDate = new Date(previousDetail.entryDate).toDateString();

      if (
        currentDate !== previousDate ||
        detail.entrySequence - previousDetail.entrySequence === 1
      ) {
        detail.openingBalance = toTwoDecimals(previousDetail.closingBalance);
      }
      currentBalance = toTwoDecimals(detail.openingBalance);
    }

    detail.closingBalance = toTwoDecimals(
      currentBalance + detail.debit - detail.credit
    );
    currentBalance = toTwoDecimals(detail.closingBalance);
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

  const previousBalance = toTwoDecimals(
    startIndex > 0
      ? record.balanceDetails[startIndex - 1].closingBalance
      : record.balanceDetails[0].openingBalance
  );

  let currentBalance = previousBalance;

  for (let i = startIndex; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    detail.openingBalance = toTwoDecimals(currentBalance);
    detail.closingBalance = toTwoDecimals(
      currentBalance + detail.debit - detail.credit
    );
    currentBalance = detail.closingBalance;
  }

  await record.save({ session });
}

async function removePaymentFromLedger(
  schoolId,
  academicYear,
  paymentEntryId,
  ledgerId,
  session
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session);

  if (!record) return;

  const originalLength = record.balanceDetails.length;
  record.balanceDetails = record.balanceDetails.filter(
    (detail) => detail.entryId?.toString() !== paymentEntryId.toString()
  );

  if (record.balanceDetails.length === originalLength) return;
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

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

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    return (a.entrySequence || 0) - (b.entrySequence || 0);
  });

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    if (i === 0) {
      const ledger = await Ledger.findById(ledgerId).session(session);
      detail.openingBalance = toTwoDecimals(ledger?.openingBalance || 0);
    } else {
      detail.openingBalance = toTwoDecimals(
        record.balanceDetails[i - 1].closingBalance
      );
    }
    detail.closingBalance = toTwoDecimals(
      detail.openingBalance + detail.debit - detail.credit
    );
  }

  await record.save({ session });
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

    // --- Track old ledger IDs like Contra does ---
    const oldItemLedgerIds = existingPaymentEntry.itemDetails.map((item) =>
      item.ledgerId?.toString()
    );
    const oldTDSorTCSLedgerId =
      existingPaymentEntry.TDSorTCSLedgerId?.toString();
    const oldPaymentModeLedgerId =
      existingPaymentEntry.ledgerIdWithPaymentMode?.toString();

    // Store old values for comparison
    const oldEntryDate = existingPaymentEntry.entryDate;
    const oldItemDetails = existingPaymentEntry.itemDetails;
    const oldTDSorTCS = existingPaymentEntry.TDSorTCS;
    const oldTDSTCSRateWithAmount = existingPaymentEntry.TDSTCSRateWithAmount;
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
      amountBeforeGST: toTwoDecimals(parseFloat(item.amountBeforeGST)) || 0,
      GSTAmount: toTwoDecimals(parseFloat(item.GSTAmount)) || 0,
      amountAfterGST:
        toTwoDecimals(parseFloat(item.amountBeforeGST) || 0) +
        (parseFloat(item.GSTAmount) || 0),
    }));

    const totalAmountBeforeGST = toTwoDecimals(
      updatedItemDetails.reduce(
        (sum, item) => sum + (parseFloat(item.amountBeforeGST) || 0),
        0
      )
    );

    const totalGSTAmount = toTwoDecimals(
      updatedItemDetails.reduce(
        (sum, item) => sum + (parseFloat(item.GSTAmount) || 0),
        0
      )
    );

    const subTotalAmountAfterGST = toTwoDecimals(
      updatedItemDetails.reduce(
        (sum, item) => sum + (parseFloat(item.amountAfterGST) || 0),
        0
      )
    );

    const parsedTDSTCSRateWithAmountBeforeGST = toTwoDecimals(
      parseFloat(TDSTCSRateWithAmountBeforeGST) || 0
    );

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

    // --- Step A: Reset old balances to zero first (like Contra does) ---
    const balanceRecords = await OpeningClosingBalance.find({
      schoolId,
      academicYear,
      "balanceDetails.entryId": id,
    }).session(session);

    for (const record of balanceRecords) {
      for (const detail of record.balanceDetails) {
        if (detail.entryId?.toString() === id.toString()) {
          detail.debit = 0;
          detail.credit = 0;
        }
      }
      await record.save({ session });
    }

    await existingPaymentEntry.save({ session });

    // --- Step B: Remove old entries if ledgers changed or removed (like Contra) ---

    // Get new ledger IDs
    const newItemLedgerIds = updatedItemDetails.map((item) =>
      item.ledgerId?.toString()
    );
    const newPaymentModeLedgerId = ledgerIdWithPaymentMode?.toString();

    // Handle TDS/TCS ledger
    let newTDSorTCSLedgerId = null;
    if (TDSorTCS && parsedTDSTCSRateWithAmountBeforeGST > 0) {
      const ledgerNameToFind =
        TDSorTCS === "TDS" ? "TDS Deducted" : "TCS Deducted";
      let tdsTcsLedger = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: { $regex: new RegExp(`^${ledgerNameToFind}$`, "i") },
      }).session(session);

      if (tdsTcsLedger) {
        newTDSorTCSLedgerId = tdsTcsLedger._id.toString();
        existingPaymentEntry.TDSorTCSLedgerId = newTDSorTCSLedgerId;
      }
    } else {
      existingPaymentEntry.TDSorTCSLedgerId = null;
    }
    await existingPaymentEntry.save({ session });

    // Remove entries from old ledgers that are no longer used
    for (const oldLedgerId of oldItemLedgerIds) {
      if (oldLedgerId && !newItemLedgerIds.includes(oldLedgerId)) {
        await removePaymentFromLedger(
          schoolId,
          academicYear,
          id,
          oldLedgerId,
          session
        );
      }
    }

    // Remove old TDS/TCS ledger entry if removed or changed
    if (oldTDSorTCSLedgerId && oldTDSorTCSLedgerId !== newTDSorTCSLedgerId) {
      await removePaymentFromLedger(
        schoolId,
        academicYear,
        id,
        oldTDSorTCSLedgerId,
        session
      );
    }

    // Remove old payment mode ledger entry if changed
    if (
      oldPaymentModeLedgerId &&
      oldPaymentModeLedgerId !== newPaymentModeLedgerId
    ) {
      await removePaymentFromLedger(
        schoolId,
        academicYear,
        id,
        oldPaymentModeLedgerId,
        session
      );
    }

    // --- Step C: Apply new balances ---
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers (Credit) - Aggregate amounts by ledgerId
    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);

    for (const [ledgerId, totalAmount] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        existingPaymentEntry._id,
        totalAmount,
        0,
        session
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // 2. TDS/TCS Ledger
    const tdsTcsAmount = Number(TDSTCSRateWithAmountBeforeGST) || 0;

    if (TDSorTCS && tdsTcsAmount > 0 && newTDSorTCSLedgerId) {
      if (TDSorTCS === "TDS") {
        // For TDS: Debit the TDS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          newTDSorTCSLedgerId,
          entryDate,
          existingPaymentEntry._id,
          0,
          tdsTcsAmount, //Credit
          session
        );
      } else if (TDSorTCS === "TCS") {
        // For TCS: Credit the TCS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          newTDSorTCSLedgerId,
          entryDate,
          existingPaymentEntry._id,
          tdsTcsAmount, //Debit
          0,
          session
        );
      }
      ledgerIdsToUpdate.add(newTDSorTCSLedgerId);
    }

    // 3. Payment Mode Ledger (Debit)
    let paymentAmount;
    if (TDSorTCS === "TDS") {
      paymentAmount = toTwoDecimals(subTotalAmountAfterGST - tdsTcsAmount);
    } else if (TDSorTCS === "TCS") {
      paymentAmount = toTwoDecimals(subTotalAmountAfterGST + tdsTcsAmount);
    } else {
      paymentAmount = toTwoDecimals(subTotalAmountAfterGST);
    }

    await updateOpeningClosingBalance(
      schoolId,
      academicYear,
      ledgerIdWithPaymentMode,
      entryDate,
      existingPaymentEntry._id,
      0,
      paymentAmount,
      session
    );
    ledgerIdsToUpdate.add(ledgerIdWithPaymentMode.toString());

    // --- Step D: Recalculate all affected ledgers ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        ledgerId,
        session
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        session
      );
    }

    await session.commitTransaction();

    return res.status(200).json({
      hasError: false,
      message: "Payment updated successfully!",
      data: existingPaymentEntry,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Payment already exists.`,
      });
    }

    console.error("Error updating Payment Entry:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  } finally {
    session.endSession();
  }
}

export default updateById;
