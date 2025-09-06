import mongoose from "mongoose";
import Contra from "../../../models/Contra.js";
import ContraValidator from "../../../validators/ContraValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";
import GroupLedger from "../../../models/GroupLedger.js";

async function generateContraVoucherNumber(schoolId, academicYear) {
  const count = await Contra.countDocuments({ schoolId, academicYear });
  const nextNumber = count + 1;
  return `CVN/${academicYear}/${nextNumber}`;
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
  contraId,
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

  // Determine effective opening balance
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

  // Check if exact same entry already exists
  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) =>
      new Date(detail.entryDate).getTime() === new Date(entryDate).getTime() &&
      detail.entryId?.toString() === contraId.toString()
  );

  if (existingEntryIndex !== -1) {
    record.balanceDetails[existingEntryIndex] = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: contraId,
    };
  } else {
    const newBalanceDetail = {
      entryDate,
      openingBalance: effectiveOpeningBalance,
      debit: debitAmount,
      credit: creditAmount,
      closingBalance,
      entryId: contraId,
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

  // Find the initial opening balance (from ledger or first entry)
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

export async function create(req, res) {
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

    const { error } = ContraValidator.ContraValidator.validate(req.body);
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
      contraEntryName,
      dateOfCashDepositedWithdrawlDate,
      narration,
      chequeNumber,
      itemDetails,
      TDSorTCS,
      TDSTCSRateAmount,
      status,
      academicYear,
    } = req.body;

    const ContraVoucherNumber = await generateContraVoucherNumber(
      schoolId,
      academicYear
    );

    const { chequeImageForContra } = req.files || {};

    let chequeImageForContraFullPath = "";
    if (chequeImageForContra?.[0]) {
      const basePath = chequeImageForContra[0].mimetype.startsWith("image/")
        ? "/Images/FinanceModule/chequeImageForContra"
        : "/Documents/FinanceModule/chequeImageForContra";
      chequeImageForContraFullPath = `${basePath}/${chequeImageForContra[0].filename}`;
    }

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      debitAmount: parseFloat(item.debitAmount) || 0,
      creditAmount: parseFloat(item.creditAmount) || 0,
    }));

    const subTotalOfDebit = updatedItemDetails.reduce(
      (sum, item) => sum + item.debitAmount,
      0
    );

    const subTotalOfCredit = updatedItemDetails.reduce(
      (sum, item) => sum + item.creditAmount,
      0
    );

    const totalAmountOfDebit =
      subTotalOfDebit + (parseFloat(TDSTCSRateAmount) || 0);
    const totalAmountOfCredit = subTotalOfCredit;

    if (totalAmountOfDebit !== totalAmountOfCredit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Total Debit and Credit amounts must be equal.",
      });
    }

    if (["Cash Deposited", "Cash Withdrawn"].includes(contraEntryName)) {
      const missingCashAccount = updatedItemDetails.some(
        (item) => !item.ledgerIdOfCashAccount
      );
      if (missingCashAccount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          hasError: true,
          message:
            "ledgerIdOfCashAccount is required for Cash Deposited or Cash Withdrawn entries.",
        });
      }
    }

    const newContra = new Contra({
      schoolId,
      contraVoucherNumber: ContraVoucherNumber,
      contraEntryName,
      entryDate,
      dateOfCashDepositedWithdrawlDate,
      narration,
      chequeNumber,
      itemDetails: updatedItemDetails,
      subTotalOfCredit: subTotalOfCredit,
      subTotalOfDebit: subTotalOfDebit,
      TDSorTCS,
      TDSTCSRateAmount,
      totalAmountOfDebit,
      totalAmountOfCredit,
      chequeImageForContra: chequeImageForContraFullPath,
      status,
      academicYear,
    });

    await newContra.save({ session });

    // Store all ledger IDs that need to be updated
    const ledgerIdsToUpdate = new Set();

    // Process based on contra entry type
    if (contraEntryName === "Cash Deposited") {
      const mainLedgerAmounts = aggregateAmountsByLedger(updatedItemDetails);
      for (const [ledgerId, amounts] of mainLedgerAmounts) {
        // Debit the main ledger (aggregated)
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          newContra.entryDate,
          newContra._id,
          amounts.debitAmount, // Aggregated debit
          0, // No credit for main ledger in Cash Deposited
          session
        );
        ledgerIdsToUpdate.add(ledgerId);
      }

      const cashAccountAmounts =
        aggregateCashAccountAmounts(updatedItemDetails);
      for (const [cashAccountId, amounts] of cashAccountAmounts) {
        // Credit the cash account (aggregated)
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          cashAccountId,
          newContra.entryDate,
          existingContra._id,
          0, // No debit for cash account in Cash Deposited
          amounts.creditAmount, // Aggregated credit
          session
        );
        ledgerIdsToUpdate.add(cashAccountId);
      }
    } else if (contraEntryName === "Cash Withdrawn") {
      // For Cash Withdrawn: Credit main ledger, Debit cash account
      const mainLedgerAmounts = aggregateAmountsByLedger(updatedItemDetails);
      for (const [ledgerId, amounts] of mainLedgerAmounts) {
        // Credit the main ledger (aggregated)
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          newContra.entryDate,
          newContra._id,
          0, // No debit for main ledger in Cash Withdrawn
          amounts.creditAmount, // Aggregated credit
          session
        );
        ledgerIdsToUpdate.add(ledgerId);
      }

      // Aggregate cash account amounts
      const cashAccountAmounts =
        aggregateCashAccountAmounts(updatedItemDetails);
      for (const [cashAccountId, amounts] of cashAccountAmounts) {
        // Debit the cash account (aggregated)
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          cashAccountId,
          newContra.entryDate,
          newContra._id,
          amounts.debitAmount, // Aggregated debit
          0, // No credit for cash account in Cash Withdrawn
          session
        );
        ledgerIdsToUpdate.add(cashAccountId);
      }
    } else if (contraEntryName === "Bank Transfer") {
      // For Bank Transfer: Process each item normally
      const ledgerAmounts = aggregateAmountsByLedger(updatedItemDetails);
      for (const [ledgerId, amounts] of ledgerAmounts) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          newContra.entryDate,
          newContra._id,
          amounts.debitAmount, // Aggregated debit
          amounts.creditAmount, // Aggregated credit
          session
        );
        ledgerIdsToUpdate.add(ledgerId.toString());
      }
    }

    // Process TDS/TCS if applicable
    let tdsTcsLedgerId = null;
    if (TDSorTCS && TDSTCSRateAmount > 0) {
      // Find TDS/TCS group ledger
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
        throw new Error(
          `${TDSorTCS} GroupLedger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      // Find TDS/TCS ledger
      let tdsTcsLedgerToUpdate = await Ledger.findOne({
        schoolId,
        academicYear,
        groupLedgerId: tdsTcsGroupLedger._id,
        ledgerName: { $regex: new RegExp(`^${TDSorTCS}$`, "i") },
      });

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
          newContra._id,
          Number(TDSTCSRateAmount),
          0
        );
      } else if (TDSorTCS === "TCS") {
        // For TCS: Credit the TCS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          tdsTcsLedgerId,
          entryDate,
          newContra._id,
          0,
          Number(TDSTCSRateAmount)
        );
      }

      ledgerIdsToUpdate.add(tdsTcsLedgerId);
    }

    // Recalculate all ledgers that were updated
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

    return res.status(201).json({
      hasError: false,
      message: "Contra created successfully!",
      data: newContra,
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
        message: `Duplicate entry for ${field}. Contra already exists.`,
      });
    }

    console.error("Error creating Contra:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
