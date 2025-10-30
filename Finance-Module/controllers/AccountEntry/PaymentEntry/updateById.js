import mongoose from "mongoose";
import moment from "moment";
import PaymentEntry from "../../../models/PaymentEntry.js";
import PaymentEntryValidator from "../../../validators/PaymentEntryValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function generatePaymentVoucherNumber(schoolId, academicYear) {
  // Find the highest existing voucher number
  const lastEntry = await PaymentEntry.findOne(
    {
      schoolId,
      academicYear,
      status: "Posted",
      paymentVoucherNumber: { $exists: true, $ne: null },
    },
    { paymentVoucherNumber: 1 },
    { sort: { paymentVoucherNumber: -1 } }
  );

  let nextNumber = 1;

  if (lastEntry && lastEntry.paymentVoucherNumber) {
    // Extract the number from the voucher string (e.g., "PVN/2025-2026/3" → 3)
    const matches = lastEntry.paymentVoucherNumber.match(/\/(\d+)$/);
    if (matches && matches[1]) {
      nextNumber = parseInt(matches[1]) + 1;
    }
  }

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

async function propagateBalanceChangeToNextYear(
  schoolId,
  currentAcademicYear,
  ledgerId,
  session
) {
  try {
    // Find the current ledger to get its details
    const currentLedger = await Ledger.findOne({
      schoolId,
      academicYear: currentAcademicYear,
      _id: ledgerId,
    }).session(session);

    if (!currentLedger) {
      console.log(`Ledger ${ledgerId} not found in ${currentAcademicYear}`);
      return;
    }

    // Calculate next academic year
    const [yearPart1, yearPart2] = currentAcademicYear.split("-");
    const nextAcademicYear = `${parseInt(yearPart1) + 1}-${
      parseInt(yearPart2) + 1
    }`;

    // Find the next year's ledger that has the CURRENT ledger as parent
    const nextYearLedger = await Ledger.findOne({
      schoolId,
      academicYear: nextAcademicYear,
      parentLedgerId: currentLedger._id,
    }).session(session);

    if (!nextYearLedger) {
      console.log(`No next year ledger found for ${currentLedger.ledgerName}`);
      return; // No next year ledger found
    }

    // Get the current year's balance record for this ledger
    const currentYearBalance = await OpeningClosingBalance.findOne({
      schoolId,
      academicYear: currentAcademicYear,
      ledgerId: ledgerId,
    }).session(session);

    let newOpeningBalance = 0;

    // FIXED: Handle both cases properly
    if (currentYearBalance && currentYearBalance.balanceDetails.length > 0) {
      // Case 1: There are balance details - use last closing balance
      const lastEntry =
        currentYearBalance.balanceDetails[
          currentYearBalance.balanceDetails.length - 1
        ];
      newOpeningBalance = lastEntry.closingBalance;
    } else {
      // Case 2: No balance details exist - use the current ledger's opening balance
      // This happens when all entries are removed or ledger has no transactions
      newOpeningBalance = currentLedger.openingBalance || 0;
    }

    // Update the next year's ledger opening balance
    await Ledger.findOneAndUpdate(
      {
        schoolId,
        academicYear: nextAcademicYear,
        _id: nextYearLedger._id,
      },
      {
        $set: {
          openingBalance: newOpeningBalance,
          balanceType: newOpeningBalance < 0 ? "Credit" : "Debit",
        },
      },
      { session }
    );

    // Update the OpeningClosingBalance for next year
    let nextYearOpeningBalance = await OpeningClosingBalance.findOne({
      schoolId,
      academicYear: nextAcademicYear,
      ledgerId: nextYearLedger._id,
    }).session(session);

    if (!nextYearOpeningBalance) {
      // Create new OpeningClosingBalance record if it doesn't exist
      nextYearOpeningBalance = new OpeningClosingBalance({
        schoolId,
        academicYear: nextAcademicYear,
        ledgerId: nextYearLedger._id,
        balanceDetails: [],
        balanceType: newOpeningBalance < 0 ? "Credit" : "Debit",
      });

      // Create initial balance detail with the new opening balance
      nextYearOpeningBalance.balanceDetails.push({
        entryDate: new Date(),
        openingBalance: newOpeningBalance,
        debit: 0,
        credit: 0,
        closingBalance: newOpeningBalance,
      });
    } else {
      // FIXED: Find and update the opening balance entry
      // Look for an entry without entryId (opening balance entry)
      let openingBalanceEntry = nextYearOpeningBalance.balanceDetails.find(
        (detail) => !detail.entryId
      );

      if (
        !openingBalanceEntry &&
        nextYearOpeningBalance.balanceDetails.length > 0
      ) {
        // If no dedicated opening balance entry, use the first entry
        openingBalanceEntry = nextYearOpeningBalance.balanceDetails[0];
      }

      if (openingBalanceEntry) {
        const oldOpeningBalance = openingBalanceEntry.openingBalance;

        // Only update if the opening balance has changed
        if (oldOpeningBalance !== newOpeningBalance) {
          openingBalanceEntry.openingBalance = newOpeningBalance;
          openingBalanceEntry.closingBalance = toTwoDecimals(
            newOpeningBalance +
              openingBalanceEntry.debit -
              openingBalanceEntry.credit
          );

          // Recalculate all subsequent entries
          let currentBalance = openingBalanceEntry.closingBalance;
          const startIndex =
            nextYearOpeningBalance.balanceDetails.indexOf(openingBalanceEntry) +
            1;

          for (
            let i = startIndex;
            i < nextYearOpeningBalance.balanceDetails.length;
            i++
          ) {
            const detail = nextYearOpeningBalance.balanceDetails[i];
            detail.openingBalance = currentBalance;
            detail.closingBalance = toTwoDecimals(
              currentBalance + detail.debit - detail.credit
            );
            currentBalance = detail.closingBalance;
          }
        }
      } else {
        // If no entries exist at all, create an opening balance entry
        nextYearOpeningBalance.balanceDetails.push({
          entryDate: new Date(),
          openingBalance: newOpeningBalance,
          debit: 0,
          credit: 0,
          closingBalance: newOpeningBalance,
        });
      }
    }

    await nextYearOpeningBalance.save({ session });

    // Recursively propagate to the next year if it exists
    await propagateBalanceChangeToNextYear(
      schoolId,
      nextAcademicYear,
      nextYearLedger._id,
      session
    );
  } catch (propagationError) {
    console.error(
      `Error in propagateBalanceChangeToNextYear for ledger ${ledgerId}:`,
      propagationError
    );
    throw propagationError;
  }
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

    // --- Track old ledger IDs ---
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
    const oldStatus = existingPaymentEntry.status;

    let paymentVoucherNumber = existingPaymentEntry.paymentVoucherNumber;
    if (
      status === "Posted" &&
      !paymentVoucherNumber &&
      oldStatus !== "Posted"
    ) {
      paymentVoucherNumber = await generatePaymentVoucherNumber(
        schoolId,
        academicYear
      );
    }

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
    existingPaymentEntry.paymentVoucherNumber = paymentVoucherNumber;
    existingPaymentEntry.status = status;

    if (
      paymentMode === "Online Net Banking" &&
      !existingPaymentEntry.transactionNumber
    ) {
      existingPaymentEntry.transactionNumber =
        await generateTransactionNumber();
    }

    // --- Step A: Reset ALL old balances to zero first (including Net Surplus and Capital Fund) ---
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

    // --- Step B: Remove old entries if ledgers changed or removed ---

    // Get new ledger IDs
    const newItemLedgerIds = updatedItemDetails.map((item) =>
      item.ledgerId?.toString()
    );
    const newPaymentModeLedgerId = ledgerIdWithPaymentMode?.toString();

    let newTDSorTCSLedgerId = null;

    existingPaymentEntry.TDSTCSRateWithAmountBeforeGST =
      parsedTDSTCSRateWithAmountBeforeGST;

    // Only set TDSorTCSLedgerId if TDS/TCS is selected AND amount is greater than 0
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
      // If TDS/TCS is removed OR amount is 0, clear the ledger ID
      existingPaymentEntry.TDSorTCSLedgerId = null;

      // Also ensure TDSTCSRateWithAmountBeforeGST is properly set to 0 when TDS/TCS is removed
      if (!TDSorTCS) {
        existingPaymentEntry.TDSTCSRateWithAmountBeforeGST = 0;
      }
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
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        oldTDSorTCSLedgerId,
        entryDate,
        existingPaymentEntry._id,
        0, // Set debit to 0
        0, // Set credit to 0
        session
      );

      // Recalculate balances for old TDS/TCS ledger
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        oldTDSorTCSLedgerId,
        session
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        oldTDSorTCSLedgerId,
        entryDate,
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
    const tdsTcsAmount = Number(parsedTDSTCSRateWithAmountBeforeGST) || 0;

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

      // Recalculate balances for new TDS/TCS ledger
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        newTDSorTCSLedgerId,
        session
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        newTDSorTCSLedgerId,
        entryDate,
        session
      );
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

    // Get all unique ledger IDs from updatedItemDetails
    const uniqueLedgerIds = [
      ...new Set(updatedItemDetails.map((item) => item.ledgerId)),
    ];

    // Find ledgers with their Head of Account information
    const ledgers = await Ledger.find({
      _id: { $in: uniqueLedgerIds },
    })
      .populate("headOfAccountId")
      .session(session);

    // Initialize sums
    let incomeBalance = 0;
    let expensesBalance = 0;

    // Calculate sums based on Head of Account
    for (const item of updatedItemDetails) {
      const ledger = ledgers.find(
        (l) => l._id.toString() === item.ledgerId.toString()
      );

      if (ledger && ledger.headOfAccountId) {
        const headOfAccountName = ledger.headOfAccountId.headOfAccountName;
        const amountAfterGST = parseFloat(item.amountAfterGST) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          incomeBalance += amountAfterGST;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          expensesBalance += amountAfterGST;
        }
      }
    }

    // Calculate total balance
    const totalBalance = toTwoDecimals(incomeBalance - expensesBalance);

    // Round to two decimals
    incomeBalance = toTwoDecimals(incomeBalance);
    expensesBalance = toTwoDecimals(expensesBalance);

    // Find or create TotalNetdeficitNetSurplus record
    let totalNetRecord = await TotalNetdeficitNetSurplus.findOne({
      schoolId,
      academicYear,
    }).session(session);

    if (!totalNetRecord) {
      totalNetRecord = new TotalNetdeficitNetSurplus({
        schoolId,
        academicYear,
        balanceDetails: [],
      });
    }

    // FIXED: Check if entry exists by entryId ONLY (not by date)
    const existingEntryIndex = totalNetRecord.balanceDetails.findIndex(
      (detail) => detail.entryId?.toString() === id.toString()
    );

    if (existingEntryIndex !== -1) {
      // Update existing entry - REPLACE values
      totalNetRecord.balanceDetails[existingEntryIndex].incomeBalance =
        incomeBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].expensesBalance =
        expensesBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].totalBalance =
        totalBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].entryDate = entryDate;
    } else {
      // Create new entry if it doesn't exist
      totalNetRecord.balanceDetails.push({
        entryDate,
        entryId: existingPaymentEntry._id,
        incomeBalance,
        expensesBalance,
        totalBalance,
      });
    }

    // Sort balanceDetails by date
    totalNetRecord.balanceDetails.sort(
      (a, b) => new Date(a.entryDate) - new Date(b.entryDate)
    );

    await totalNetRecord.save({ session });

    // ========= Net Surplus/(Deficit) Ledger and Capital Fund ===========

    const netSurplusDeficitLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Net Surplus/(Deficit)",
    }).session(session);

    if (!netSurplusDeficitLedger) {
      throw new Error("Net Surplus/(Deficit) ledger not found");
    }

    // Calculate amounts for Net Surplus/(Deficit)
    let netSurplusCreditAmount = 0;
    let hasIncome = false;
    let hasExpenses = false;

    // Calculate income and expenses totals
    let incomeTotal = 0;
    let expensesTotal = 0;

    for (const item of updatedItemDetails) {
      const ledger = ledgers.find(
        (l) => l._id.toString() === item.ledgerId.toString()
      );

      if (ledger && ledger.headOfAccountId) {
        const headOfAccountName = ledger.headOfAccountId.headOfAccountName;
        const amountAfterGST = parseFloat(item.amountAfterGST) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          hasIncome = true;
          incomeTotal += amountAfterGST;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          hasExpenses = true;
          expensesTotal += amountAfterGST;
        }
      }
    }

    incomeTotal = toTwoDecimals(incomeTotal);
    expensesTotal = toTwoDecimals(expensesTotal);

    // Determine Net Surplus/(Deficit) amounts based on scenarios
    if (hasIncome && hasExpenses) {
      // Scenario 1: Both Income & Expenses
      netSurplusCreditAmount = incomeTotal - expensesTotal;
    } else if (hasIncome && !hasExpenses) {
      // Scenario 2: Only Income
      netSurplusCreditAmount = incomeTotal;
    } else if (!hasIncome && hasExpenses) {
      // Scenario 3: Only Expenses
      netSurplusCreditAmount = expensesTotal;
    }

    netSurplusCreditAmount = toTwoDecimals(netSurplusCreditAmount);

    // Check if we need to remove the Net Surplus/(Deficit) entry completely
    if (netSurplusCreditAmount === 0) {
      // Remove the entry completely if amount is 0 (no income/expenses)
      await removePaymentFromLedger(
        schoolId,
        academicYear,
        id,
        netSurplusDeficitLedger._id,
        session
      );
    } else {
      // Update Net Surplus/(Deficit) ledger
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        existingPaymentEntry._id,
        0,
        netSurplusCreditAmount,
        session
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        session
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        session
      );
    }

    // ========= Capital Fund Ledger ===========
    const capitalFundLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Capital Fund",
    }).session(session);

    if (!capitalFundLedger) {
      throw new Error("Capital Fund ledger not found");
    }

    let capitalFundDebitAmount = 0;

    if (hasIncome && hasExpenses) {
      // Scenario 1: Credit Capital Fund with (income - expenses)
      capitalFundDebitAmount = incomeTotal - expensesTotal;
    } else if (hasIncome && !hasExpenses) {
      // Scenario 2: Credit Capital Fund with income amount
      capitalFundDebitAmount = incomeTotal;
    } else if (!hasIncome && hasExpenses) {
      // Scenario 3: Debit Capital Fund with expenses amount
      capitalFundDebitAmount = expensesTotal;
    }

    capitalFundDebitAmount = toTwoDecimals(capitalFundDebitAmount);

    // Check if we need to remove the Capital Fund entry completely
    if (capitalFundDebitAmount === 0) {
      // Remove the entry completely if amount is 0 (no income/expenses)
      await removePaymentFromLedger(
        schoolId,
        academicYear,
        id,
        capitalFundLedger._id,
        session
      );
    } else {
      // Update Capital Fund ledger
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        existingPaymentEntry._id,
        capitalFundDebitAmount,
        0,
        session
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        session
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        session
      );
    }

    // --- Step E: Propagate changes to subsequent academic years ---
    const affectedLedgerIds = new Set([...ledgerIdsToUpdate]);

    // Also include Net Surplus/(Deficit) and Capital Fund if they were affected
    if (netSurplusDeficitLedger) {
      affectedLedgerIds.add(netSurplusDeficitLedger._id.toString());
    }
    if (capitalFundLedger) {
      affectedLedgerIds.add(capitalFundLedger._id.toString());
    }

    // FIXED: Include ALL ledgers that need propagation (both current and old TDS/TCS)
    const allLedgersToPropagate = new Set([...affectedLedgerIds]);

    // Add old TDS/TCS ledger if it was changed (for propagation)
    if (oldTDSorTCSLedgerId && oldTDSorTCSLedgerId !== newTDSorTCSLedgerId) {
      allLedgersToPropagate.add(oldTDSorTCSLedgerId);
    }

    // Add new TDS/TCS ledger if it exists
    if (newTDSorTCSLedgerId) {
      allLedgersToPropagate.add(newTDSorTCSLedgerId);
    }

    // FIXED: CRITICAL - Also include ALL old item ledgers and payment mode ledgers
    for (const oldLedgerId of oldItemLedgerIds) {
      if (oldLedgerId) {
        allLedgersToPropagate.add(oldLedgerId);
      }
    }

    if (oldPaymentModeLedgerId) {
      allLedgersToPropagate.add(oldPaymentModeLedgerId);
    }

    console.log(
      `All ledger IDs for propagation:`,
      Array.from(allLedgersToPropagate)
    );

    // Propagate changes for each affected ledger
    for (const ledgerId of allLedgersToPropagate) {
      try {
        await propagateBalanceChangeToNextYear(
          schoolId,
          academicYear,
          ledgerId,
          session
        );
      } catch (propagationError) {
        console.error(
          `Error propagating changes for ledger ${ledgerId}:`,
          propagationError
        );
        // Don't throw here - we want to continue with other ledgers
      }
    }

    await session.commitTransaction();
    session.endSession();

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
