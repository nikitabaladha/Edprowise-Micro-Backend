import mongoose from "mongoose";
import PaymentEntry from "../../../models/PaymentEntry.js";
import PaymentEntryValidator from "../../../validators/CustomizeEntryForPaymentValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import TotalNetdeficitNetSurplus from "../../../models/TotalNetdeficitNetSurplus.js";

import { hasBankOrCashLedger } from "../../CommonFunction/CommonFunction.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function generatePaymentVoucherNumber(schoolId, academicYear) {
  const count = await PaymentEntry.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `PVN/${academicYear}/${nextNumber}`;
}

async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  session // Added session parameter
) {
  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session); // Added session

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
  }).session(session); // Added session

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
  creditAmount = 0,
  session // Added session parameter
) {
  debitAmount = toTwoDecimals(debitAmount);
  creditAmount = toTwoDecimals(creditAmount);

  const { record, openingBalance, balanceType } =
    await getOrCreateOpeningBalanceRecord(
      schoolId,
      academicYear,
      ledgerId,
      entryDate,
      session // Pass session
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
      detail.entryId?.toString() === paymentEntryId.toString()
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

  // Sort by date (and then by _id to ensure chaining order within same day)
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    return dateDiff !== 0
      ? dateDiff
      : a._id.toString().localeCompare(b._id.toString());
  });

  await record.save({ session }); // Added session
  return record;
}

async function recalculateLedgerBalances(
  schoolId,
  academicYear,
  ledgerId,
  session // Added session parameter
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session); // Added session

  if (!record || record.balanceDetails.length === 0) {
    return;
  }

  const ledger = await Ledger.findOne({
    schoolId,
    academicYear,
    _id: ledgerId,
  }).session(session); // Added session

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

  await record.save({ session }); // Added session
}

async function recalculateAllBalancesAfterDate(
  schoolId,
  academicYear,
  ledgerId,
  date,
  session // Added session parameter
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session); // Added session

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
    }).session(session); // Added session

    const balanceType = ledger?.balanceType || "Debit";

    if (balanceType === "Debit") {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    } else {
      detail.closingBalance = currentBalance + detail.debit - detail.credit;
    }

    currentBalance = detail.closingBalance;
  }

  await record.save({ session }); // Added session
}

function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const amountAfterGST = toTwoDecimals(item.amountAfterGST) || 0;
    const creditAmount = toTwoDecimals(item.creditAmount) || 0;

    if (ledgerMap.has(ledgerId)) {
      const existing = ledgerMap.get(ledgerId);
      ledgerMap.set(ledgerId, {
        amountAfterGST: existing.amountAfterGST + amountAfterGST,
        creditAmount: existing.creditAmount + creditAmount,
      });
    } else {
      ledgerMap.set(ledgerId, {
        amountAfterGST: amountAfterGST,
        creditAmount: creditAmount,
      });
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
      entryDate,
      invoiceDate,
      narration,
      itemDetails,
      status,
      totalAmountAfterGST,
      totalCreditAmount,
      customizeEntry,
      academicYear,
    } = req.body;

    const hasValidLedger = await hasBankOrCashLedger(
      schoolId,
      academicYear,
      itemDetails
    );

    if (!hasValidLedger) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message:
          "At least one ledger must have Group Ledger Name as 'Bank' or 'Cash'",
      });
    }

    const paymentVoucherNumber = await generatePaymentVoucherNumber(
      schoolId,
      academicYear
    );

    const { invoiceImage } = req.files || {};

    const invoiceImageFullPath = invoiceImage?.[0]
      ? `${
          invoiceImage[0].mimetype.startsWith("image/")
            ? "/Images/FinanceModule/InvoiceImage"
            : "/Documents/FinanceModule/InvoiceImage"
        }/${invoiceImage[0].filename}`
      : null;

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      amountAfterGST: parseFloat(item.amountAfterGST) || 0,
      creditAmount: parseFloat(item.creditAmount) || 0,
    }));

    const subTotalAmountAfterGST = toTwoDecimals(
      updatedItemDetails.reduce(
        (sum, item) => sum + (parseFloat(item.amountAfterGST) || 0),
        0
      )
    );

    const subTotalOfCredit = toTwoDecimals(
      updatedItemDetails.reduce(
        (sum, item) => sum + (parseFloat(item.creditAmount) || 0),
        0
      )
    );

    const newPaymentEntry = new PaymentEntry({
      schoolId,
      paymentVoucherNumber,
      entryDate,
      invoiceDate,
      narration,
      itemDetails: updatedItemDetails,
      subTotalAmountAfterGST,
      subTotalOfCredit,
      totalAmountAfterGST,
      totalCreditAmount,
      customizeEntry,
      invoiceImage: invoiceImageFullPath,
      status,
      academicYear,
    });

    await newPaymentEntry.save({ session });

    // Store all ledger IDs that need to be updated
    const ledgerIdsToUpdate = new Set();

    // 1. Item Ledgers - Aggregate amounts by ledgerId
    const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);

    for (const [ledgerId, amounts] of ledgerAmounts) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        newPaymentEntry._id,
        amounts.amountAfterGST,
        amounts.creditAmount,
        session // Added session
      );
      ledgerIdsToUpdate.add(ledgerId);
    }

    // --- Recalculate all ledgers that were updated ---
    for (const ledgerId of ledgerIdsToUpdate) {
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        ledgerId,
        session // Added session
      );

      // Also recalculate all entries after this date to handle backdated entries
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        session // Added session
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
      .session(session); // Added session

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
        const creditAmount = parseFloat(item.creditAmount) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          incomeBalance += amountAfterGST - creditAmount;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          expensesBalance += amountAfterGST - creditAmount;
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
      (detail) => detail.entryId?.toString() === newPaymentEntry._id.toString()
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
        entryId: newPaymentEntry._id,
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

    // =====Start Of Net Surplus/(Deficit)...Capital Fund=====

    // Find the required ledgers
    const netSurplusDeficitLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Net Surplus/(Deficit)",
    }).session(session);

    const capitalFundLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Capital Fund",
    }).session(session);

    if (!netSurplusDeficitLedger || !capitalFundLedger) {
      throw new Error(
        "Required ledgers (Net Surplus/(Deficit) or Capital Fund) not found"
      );
    }

    // Initialize amounts for both ledgers
    let netSurplusDebitAmount = 0;
    let netSurplusCreditAmount = 0;
    let capitalFundDebitAmount = 0;
    let capitalFundCreditAmount = 0;

    // Analyze each journal item to determine the correct posting
    for (const item of updatedItemDetails) {
      const ledger = ledgers.find(
        (l) => l._id.toString() === item.ledgerId.toString()
      );

      if (ledger && ledger.headOfAccountId) {
        const headOfAccountName =
          ledger.headOfAccountId.headOfAccountName.toLowerCase();
        const amountAfterGST = parseFloat(item.amountAfterGST) || 0;
        const creditAmount = parseFloat(item.creditAmount) || 0;

        // Scenario analysis based on your requirements
        if (headOfAccountName === "income") {
          if (creditAmount > 0) {
            // Income with credit amount → Net Surplus Debit, Capital Fund Credit
            netSurplusDebitAmount += creditAmount;
            capitalFundCreditAmount += creditAmount;
          }
          if (amountAfterGST > 0) {
            // Income with debit amount → Net Surplus Credit, Capital Fund Debit
            netSurplusCreditAmount += amountAfterGST;
            capitalFundDebitAmount += amountAfterGST;
          }
        } else if (headOfAccountName === "expenses") {
          if (creditAmount > 0) {
            // Expenses with credit amount → Net Surplus Debit, Capital Fund Credit
            netSurplusDebitAmount += creditAmount;
            capitalFundCreditAmount += creditAmount;
          }
          if (amountAfterGST > 0) {
            // Expenses with debit amount → Net Surplus Credit, Capital Fund Debit
            netSurplusCreditAmount += amountAfterGST;
            capitalFundDebitAmount += amountAfterGST;
          }
        }
      }
    }

    // Round to two decimals
    netSurplusDebitAmount = toTwoDecimals(netSurplusDebitAmount);
    netSurplusCreditAmount = toTwoDecimals(netSurplusCreditAmount);
    capitalFundDebitAmount = toTwoDecimals(capitalFundDebitAmount);
    capitalFundCreditAmount = toTwoDecimals(capitalFundCreditAmount);

    // Update Net Surplus/(Deficit) ledger
    if (netSurplusDebitAmount > 0 || netSurplusCreditAmount > 0) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        newPaymentEntry._id,
        netSurplusDebitAmount,
        netSurplusCreditAmount,
        session // Added session
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        session // Added session
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        session // Added session
      );

      // ADDED: Add to ledgerIdsToUpdate for propagation
      ledgerIdsToUpdate.add(netSurplusDeficitLedger._id.toString());
    }

    // Update Capital Fund ledger
    if (capitalFundDebitAmount > 0 || capitalFundCreditAmount > 0) {
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        newPaymentEntry._id,
        capitalFundDebitAmount,
        capitalFundCreditAmount,
        session // Added session
      );

      // Recalculate balances
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        session // Added session
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        capitalFundLedger._id,
        entryDate,
        session // Added session
      );

      // ADDED: Add to ledgerIdsToUpdate for propagation
      ledgerIdsToUpdate.add(capitalFundLedger._id.toString());
    }

    // =====End of Net Surplus/(Deficit)...Capital Fund=====

    // ADDED: Propagation to next academic years (same as your update API)
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
          `Error propagating changes for ledger ${ledgerId}:`,
          propagationError
        );
        // Don't throw here - we want to continue with other ledgers
      }
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
