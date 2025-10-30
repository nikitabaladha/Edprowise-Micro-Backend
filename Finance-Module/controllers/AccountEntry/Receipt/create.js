import mongoose from "mongoose";
import moment from "moment";
import Receipt from "../../../models/Receipt.js";
import ReceiptValidator from "../../../validators/ReceiptValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function generateReceiptVoucherNumber(schoolId, academicYear) {
  // Find the highest existing voucher number
  const lastEntry = await Receipt.findOne(
    {
      schoolId,
      academicYear,
      status: "Posted",
      receiptVoucherNumber: { $exists: true, $ne: null },
    },
    { receiptVoucherNumber: 1 },
    { sort: { receiptVoucherNumber: -1 } }
  );

  let nextNumber = 1;

  if (lastEntry && lastEntry.receiptVoucherNumber) {
    const matches = lastEntry.receiptVoucherNumber.match(/\/(\d+)$/);
    if (matches && matches[1]) {
      nextNumber = parseInt(matches[1]) + 1;
    }
  }

  return `RVN/${academicYear}/${nextNumber}`;
}

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

async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  session // ADDED: session parameter
) {
  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session); // ADDED: session

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
  }).session(session); // ADDED: session

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
  creditAmount = 0,
  session // ADDED: session parameter
) {
  debitAmount = toTwoDecimals(debitAmount);
  creditAmount = toTwoDecimals(creditAmount);

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate,
      session // ADDED: session
    );

  // --- FIX: Determine effective opening balance ---
  const previousBalanceDetails = record.balanceDetails
    .filter((detail) => new Date(detail.entryDate) <= new Date(entryDate))
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  let effectiveOpeningBalance = toTwoDecimals(openingBalance);

  if (previousBalanceDetails.length > 0) {
    effectiveOpeningBalance = toTwoDecimals(
      previousBalanceDetails[0].closingBalance
    );
  }

  // --- Calculate closing balance ---
  let closingBalance;
  if (balanceType === "Debit") {
    closingBalance = toTwoDecimals(
      effectiveOpeningBalance + debitAmount - creditAmount
    );
  } else {
    closingBalance = toTwoDecimals(
      effectiveOpeningBalance + debitAmount - creditAmount
    );
  }

  // --- Check if exact same entry already exists ---
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
      entryId: receiptId, // Store Receipt _id as entryId
    };
  } else {
    const newBalanceDetail = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: receiptId, // Store Receipt _id as entryId
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

  await record.save({ session }); // ADDED: session
  return record;
}

async function recalculateLedgerBalances(
  schoolId,
  academicYear,
  ledgerId,
  session // ADDED: session parameter
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session); // ADDED: session

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session); // ADDED: session

  const balanceType = ledger?.balanceType || "Debit";

  // Sort all entries by date, then by _id for consistent same-day order
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  // Find the initial opening balance (from ledger or first entry)
  let currentBalance = toTwoDecimals(record.balanceDetails[0].openingBalance);

  for (let i = 0; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];

    if (i === 0) {
      currentBalance = detail.openingBalance;
    } else {
      // Update opening balance to previous closing balance
      detail.openingBalance = toTwoDecimals(
        record.balanceDetails[i - 1].closingBalance
      );
      currentBalance = detail.openingBalance;
    }

    // Calculate new closing balance
    if (balanceType === "Debit") {
      detail.closingBalance = toTwoDecimals(
        currentBalance + detail.debit - detail.credit
      );
    } else {
      detail.closingBalance = toTwoDecimals(
        currentBalance + detail.debit - detail.credit
      );
    }

    currentBalance = detail.closingBalance;
  }

  await record.save({ session }); // ADDED: session
}

async function recalculateAllBalancesAfterDate(
  schoolId,
  academicYear,
  ledgerId,
  date,
  session // ADDED: session parameter
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session); // ADDED: session

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
    }).session(session); // ADDED: session

    const balanceType = ledger?.balanceType || "Debit";

    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save({ session }); // ADDED: session
}

function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const amount = toTwoDecimals(item.amount) || 0;

    if (ledgerMap.has(ledgerId)) {
      ledgerMap.set(ledgerId, ledgerMap.get(ledgerId) + amount);
    } else {
      ledgerMap.set(ledgerId, amount);
    }
  });

  return ledgerMap;
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

    const { error } = ReceiptValidator.ReceiptValidator.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      await session.abortTransaction();
      session.endSession();
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
      status,
      TDSTCSRateWithAmount,
      ledgerIdWithPaymentMode,
      academicYear,
      totalAmount,
    } = req.body;

    let receiptVoucherNumber = null;

    // Only generate voucher number if status is "Posted" from the beginning
    if (status === "Posted") {
      receiptVoucherNumber = await generateReceiptVoucherNumber(
        schoolId,
        academicYear
      );
    }

    const { receiptImage, chequeImageForReceipt } = req.files || {};

    let receiptImageFullPath = null;
    if (receiptImage?.[0]) {
      const receiptImagePath = receiptImage[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/ReceiptImage"
        : "/Documents/FinanceModule/ReceiptImage";

      receiptImageFullPath = `${receiptImagePath}/${receiptImage[0].filename}`;
    }

    let chequeImageForReceiptFullPath = null;
    if (chequeImageForReceipt?.[0]) {
      const chequeImageForReceiptPath =
        chequeImageForReceipt[0].mimetype.startsWith("image/")
          ? "/Images/FinanceModule/chequeImageForReceipt"
          : "/Documents/FinanceModule/chequeImageForReceipt";

      chequeImageForReceiptFullPath = `${chequeImageForReceiptPath}/${chequeImageForReceipt[0].filename}`;
    }

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amount: parseFloat(item.amount) || 0,
    }));

    const subTotalAmount = toTwoDecimals(
      updatedItemDetails.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0
      )
    );

    const transactionNumber =
      paymentMode === "Online Net Banking"
        ? await generateTransactionNumber()
        : null;

    let TDSorTCSLedgerId = null;

    if (TDSorTCS && TDSTCSRateWithAmount > 0) {
      // Search for "TDS on Receipts" or "TCS on Receipts" ledger
      const ledgerNameToFind =
        TDSorTCS === "TDS" ? "TDS on Receipts" : "TCS on Receipts";

      // Find the ledger with exact name match
      let tdsTcsLedgerToUpdate = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: { $regex: new RegExp(`^${ledgerNameToFind}$`, "i") },
      }).session(session); // ADDED: session

      if (!tdsTcsLedgerToUpdate) {
        throw new Error(
          `${ledgerNameToFind} Ledger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      TDSorTCSLedgerId = tdsTcsLedgerToUpdate._id.toString();
    }

    const newReceipt = new Receipt({
      schoolId,
      receiptVoucherNumber,
      entryDate,
      receiptDate,
      narration,
      paymentMode,
      chequeNumber,
      transactionNumber,
      itemDetails: updatedItemDetails,
      subTotalAmount,
      TDSorTCS,
      TDSTCSRateChartId,
      TDSTCSRate,
      TDSTCSRateWithAmount,
      totalAmount,
      receiptImage: receiptImageFullPath,
      chequeImageForReceipt: chequeImageForReceiptFullPath,
      ledgerIdWithPaymentMode,
      status,
      academicYear,
      TDSorTCSLedgerId,
    });

    await newReceipt.save({ session });

    // Store all ledger IDs that need to be updated
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers (Credit)
    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);

    for (const [ledgerId, amount] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        newReceipt._id,
        0, // debit
        amount, // credit
        session // ADDED: session parameter
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // 2. TDS/TCS Ledger (Debit for TDS, Credit for TCS)
    if (TDSorTCS && TDSTCSRateWithAmount > 0 && TDSorTCSLedgerId) {
      if (TDSorTCS === "TDS") {
        // For TDS: Debit the TDS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSorTCSLedgerId,
          entryDate,
          newReceipt._id,
          Number(TDSTCSRateWithAmount), // debit
          0, // credit
          session // ADDED: session parameter
        );
      } else if (TDSorTCS === "TCS") {
        // For TCS: Credit the TCS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSorTCSLedgerId,
          entryDate,
          newReceipt._id,
          0, // debit
          Number(TDSTCSRateWithAmount), // credit
          session // ADDED: session parameter
        );
      }

      ledgerIdsToUpdate.add(TDSorTCSLedgerId);
    }

    // 3. Payment Mode Ledger (Debit)
    const tdsTcsAmount = Number(TDSTCSRateWithAmount) || 0;

    let paymentAmount;
    if (TDSorTCS === "TDS") {
      paymentAmount = toTwoDecimals(subTotalAmount - tdsTcsAmount);
    } else if (TDSorTCS === "TCS") {
      paymentAmount = toTwoDecimals(subTotalAmount + tdsTcsAmount);
    } else {
      paymentAmount = toTwoDecimals(subTotalAmount);
    }

    await updateOpeningClosingBalance(
      schoolId,
      academicYear,
      ledgerIdWithPaymentMode,
      entryDate,
      newReceipt._id,
      paymentAmount, // debit
      0, // credit
      session // ADDED: session parameter
    );
    ledgerIdsToUpdate.add(ledgerIdWithPaymentMode.toString());

    // --- Recalculate all ledgers that were updated ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        ledgerId,
        session // ADDED: session parameter
      );

      // Also recalculate all entries after this date to handle backdated entries
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        session // ADDED: session parameter
      );
    }

    // Get all unique ledger IDs from itemDetails
    const uniqueLedgerIds = [
      ...new Set(updatedItemDetails.map((item) => item.ledgerId)),
    ];

    // Find ledgers with their Head of Account information
    const ledgers = await Ledger.find({
      _id: { $in: uniqueLedgerIds },
    })
      .populate("headOfAccountId")
      .session(session); // ADDED: session

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
        const amount = parseFloat(item.amount) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          incomeBalance += -amount;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          expensesBalance += -amount;
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

    const existingEntryIndex = totalNetRecord.balanceDetails.findIndex(
      (detail) => detail.entryId?.toString() === newReceipt._id.toString()
    );

    if (existingEntryIndex !== -1) {
      totalNetRecord.balanceDetails[existingEntryIndex].incomeBalance =
        incomeBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].expensesBalance =
        expensesBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].totalBalance =
        totalBalance;
      totalNetRecord.balanceDetails[existingEntryIndex].entryDate = entryDate;
    } else {
      totalNetRecord.balanceDetails.push({
        entryDate,
        entryId: newReceipt._id,
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

    // =====Net Surplus/(Deficit)...Capital Fund=====

    // ========= Net Surplus/(Deficit) Ledger ===========
    const netSurplusDeficitLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Net Surplus/(Deficit)",
    }).session(session);

    if (!netSurplusDeficitLedger) {
      throw new Error("Net Surplus/(Deficit) ledger not found");
    }

    // Calculate amounts for Net Surplus/(Deficit)
    let netSurplusDebitAmount = 0;
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
        const amount = parseFloat(item.amount) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          hasIncome = true;
          incomeTotal += amount;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          hasExpenses = true;
          expensesTotal += amount;
        }
      }
    }

    incomeTotal = toTwoDecimals(incomeTotal);
    expensesTotal = toTwoDecimals(expensesTotal);

    // Determine Net Surplus/(Deficit) amounts based on scenarios
    if (hasIncome && hasExpenses) {
      // Scenario 1: Both Income & Expenses
      netSurplusDebitAmount = incomeTotal - expensesTotal;
    } else if (hasIncome && !hasExpenses) {
      // Scenario 2: Only Income
      netSurplusDebitAmount = incomeTotal;
    } else if (!hasIncome && hasExpenses) {
      // Scenario 3: Only Expenses
      netSurplusDebitAmount = expensesTotal;
    }

    netSurplusDebitAmount = toTwoDecimals(netSurplusDebitAmount);

    // Update Net Surplus/(Deficit) ledger
    if (netSurplusDebitAmount !== 0) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        newReceipt._id,
        netSurplusDebitAmount,
        0,
        session // ADDED: session parameter
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        session // ADDED: session parameter
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        session // ADDED: session parameter
      );

      ledgerIdsToUpdate.add(netSurplusDeficitLedger._id.toString());
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

    let capitalFundCreditAmount = 0;

    if (hasIncome && hasExpenses) {
      // Scenario 1: Credit Capital Fund with (income - expenses)
      capitalFundCreditAmount = incomeTotal - expensesTotal;
    } else if (hasIncome && !hasExpenses) {
      // Scenario 2: Credit Capital Fund with income amount
      capitalFundCreditAmount = incomeTotal;
    } else if (!hasIncome && hasExpenses) {
      // Scenario 3: Debit Capital Fund with expenses amount
      capitalFundCreditAmount = expensesTotal;
    }

    capitalFundCreditAmount = toTwoDecimals(capitalFundCreditAmount);

    if (capitalFundCreditAmount !== 0) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        newReceipt._id,
        0,
        capitalFundCreditAmount,
        session // ADDED: session parameter
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        session // ADDED: session parameter
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        session // ADDED: session parameter
      );

      ledgerIdsToUpdate.add(capitalFundLedger._id.toString());
    }

    // ========= PROPAGATE CHANGES TO SUBSEQUENT ACADEMIC YEARS =========
    // This is the key addition that was missing

    console.log(
      `All ledger IDs for propagation in receipt create:`,
      Array.from(ledgerIdsToUpdate)
    );

    // Propagate changes for each affected ledger
    for (const ledgerId of ledgerIdsToUpdate) {
      try {
        await propagateBalanceChangeToNextYear(
          schoolId,
          academicYear,
          ledgerId,
          session
        );
      } catch (propagationError) {
        console.error(
          `Error propagating changes for ledger ${ledgerId} during receipt create:`,
          propagationError
        );
        // Don't throw here - we want to continue with other ledgers
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      hasError: false,
      message: "Receipt created successfully!",
      data: newReceipt,
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

    console.error("Error creating Receipt:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
