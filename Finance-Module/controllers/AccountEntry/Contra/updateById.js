import mongoose from "mongoose";
import Contra from "../../../models/Contra.js";
import ContraValidator from "../../../validators/ContraValidator.js";
import OpeningClosingBalance from "../../../models/OpeningClosingBalance.js";
import Ledger from "../../../models/Ledger.js";

function toTwoDecimals(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function getOrCreateOpeningBalanceRecord(
  schoolId,
  academicYear,
  ledgerId,
  entryDate,
  session = null
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
  }).session(session);

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
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  if (previousBalanceDetails.length > 0) {
    openingBalance = toTwoDecimals(previousBalanceDetails[0].closingBalance);
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
  creditAmount = 0,
  session = null
) {
  debitAmount = toTwoDecimals(Number(debitAmount));
  creditAmount = toTwoDecimals(Number(creditAmount));

  const { record, openingBalance } = await getOrCreateOpeningBalanceRecord(
    schoolId,
    academicYear,
    ledgerId,
    entryDate,
    session
  );

  const existingEntryIndex = record.balanceDetails.findIndex(
    (detail) => detail.entryId?.toString() === contraId.toString()
  );

  let entrySequence;

  if (existingEntryIndex !== -1) {
    const existing = record.balanceDetails[existingEntryIndex];
    entrySequence = existing.entrySequence;
    existing.debit = debitAmount;
    existing.credit = creditAmount;
    existing.entryDate = entryDate;
  } else {
    const sameDayEntries = record.balanceDetails.filter(
      (d) =>
        new Date(d.entryDate).toISOString() ===
        new Date(entryDate).toISOString()
    );
    entrySequence =
      sameDayEntries.length > 0
        ? Math.max(...sameDayEntries.map((d) => d.entrySequence || 0)) + 1
        : 1;

    record.balanceDetails.push({
      entryDate,
      entrySequence,
      debit: debitAmount,
      credit: creditAmount,
      entryId: contraId,
    });
  }

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    if ((a.entrySequence || 0) !== (b.entrySequence || 0)) {
      return (a.entrySequence || 0) - (b.entrySequence || 0);
    }
    return a._id.toString().localeCompare(b._id.toString());
  });

  record.balanceDetails.forEach((detail, index) => {
    if (index === 0) {
      detail.openingBalance = openingBalance;
    } else {
      detail.openingBalance = record.balanceDetails[index - 1].closingBalance;
    }
    detail.closingBalance =
      detail.openingBalance + (detail.debit || 0) - (detail.credit || 0);
  });

  await record.save({ session });
  return record;
}

async function recalculateAllBalancesAfterDate(
  schoolId,
  academicYear,
  ledgerId,
  date,
  session = null
) {
  const record = await OpeningClosingBalance.findOne({
    schoolId,
    academicYear,
    ledgerId,
  }).session(session);

  if (!record || record.balanceDetails.length === 0) return;

  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    if ((a.entrySequence || 0) !== (b.entrySequence || 0)) {
      return (a.entrySequence || 0) - (b.entrySequence || 0);
    }
    return a._id.toString().localeCompare(b._id.toString());
  });

  const startIndex = record.balanceDetails.findIndex(
    (detail) => new Date(detail.entryDate) > new Date(date)
  );
  if (startIndex === -1) return;

  let currentBalance =
    startIndex > 0
      ? toTwoDecimals(record.balanceDetails[startIndex - 1].closingBalance)
      : toTwoDecimals(record.balanceDetails[0].openingBalance);

  for (let i = startIndex; i < record.balanceDetails.length; i++) {
    const detail = record.balanceDetails[i];
    detail.openingBalance = currentBalance;
    detail.closingBalance =
      currentBalance + (detail.debit || 0) - (detail.credit || 0);
    currentBalance = detail.closingBalance;
  }

  await record.save({ session });
}

function aggregateAmountsByLedger(itemDetails) {
  const ledgerMap = new Map();

  itemDetails.forEach((item) => {
    const ledgerId = item.ledgerId.toString();
    const debitAmount = toTwoDecimals(item.debitAmount) || 0;
    const creditAmount = toTwoDecimals(item.creditAmount) || 0;

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
      const debitAmount = toTwoDecimals(item.debitAmount) || 0;
      const creditAmount = toTwoDecimals(item.creditAmount) || 0;

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

async function removeContraEntryFromLedger(
  schoolId,
  academicYear,
  contraId,
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
    (detail) => detail.entryId?.toString() !== contraId.toString()
  );

  if (record.balanceDetails.length === originalLength) return; // nothing removed

  // Sort the remaining entries
  record.balanceDetails.sort((a, b) => {
    const dateDiff = new Date(a.entryDate) - new Date(b.entryDate);
    if (dateDiff !== 0) return dateDiff;
    if ((a.entrySequence || 0) !== (b.entrySequence || 0)) {
      return (a.entrySequence || 0) - (b.entrySequence || 0);
    }
    return a._id.toString().localeCompare(b._id.toString());
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
      detail.openingBalance + (detail.debit || 0) - (detail.credit || 0);
  }

  await record.save({ session });
}

export const updateById = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { schoolId } = req.user;
    if (!schoolId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(401)
        .json({ hasError: true, message: "Unauthorized request." });
    }

    const { id, academicYear } = req.params;
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
    } = req.body;

    const { error } = ContraValidator.ContraValidatorUpdate.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ hasError: true, message: errorMessages });
    }

    const existingContra = await Contra.findOne({
      _id: id,
      schoolId,
      academicYear,
    }).session(session);
    if (!existingContra) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ hasError: true, message: "Contra not found." });
    }

    // --- Track old ledger/cash/TDS ids ---
    const oldLedgerIds = existingContra.itemDetails.map((item) =>
      item.ledgerId?.toString()
    );
    const oldCashAccountIds = existingContra.itemDetails
      .filter((item) => item.ledgerIdOfCashAccount)
      .map((item) => item.ledgerIdOfCashAccount.toString());
    const oldTDSorTCSId = existingContra.TDSorTCSLedgerId?.toString();

    // Step A: Reset old debit/credit
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

    // Step B: Update contra document
    existingContra.entryDate = entryDate || existingContra.entryDate;
    existingContra.contraEntryName =
      contraEntryName || existingContra.contraEntryName;
    existingContra.dateOfCashDepositedWithdrawlDate =
      dateOfCashDepositedWithdrawlDate ||
      existingContra.dateOfCashDepositedWithdrawlDate;
    existingContra.narration = narration || existingContra.narration;
    existingContra.chequeNumber = chequeNumber || existingContra.chequeNumber;

    const updatedItemDetails = itemDetails.map((item) => ({
      ...item,
      debitAmount: toTwoDecimals(item.debitAmount) || 0,
      creditAmount: toTwoDecimals(item.creditAmount) || 0,
    }));
    existingContra.itemDetails = updatedItemDetails;

    const subTotalOfDebit = toTwoDecimals(
      updatedItemDetails.reduce((sum, item) => sum + item.debitAmount, 0)
    );

    const subTotalOfCredit = toTwoDecimals(
      updatedItemDetails.reduce((sum, item) => sum + item.creditAmount, 0)
    );

    const tdsTcsAmount = TDSorTCS ? toTwoDecimals(TDSTCSRateAmount) || 0 : 0;

    const totalAmountOfDebit =
      subTotalOfDebit + (toTwoDecimals(TDSTCSRateAmount) || 0);
    const totalAmountOfCredit = subTotalOfCredit;

    if (totalAmountOfDebit !== totalAmountOfCredit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        hasError: true,
        message: "Total Debit and Credit amounts must be equal.",
      });
    }

    existingContra.subTotalOfDebit = subTotalOfDebit;
    existingContra.subTotalOfCredit = subTotalOfCredit;

    existingContra.TDSorTCS = TDSorTCS || "";
    existingContra.TDSTCSRateAmount = tdsTcsAmount;

    // Fix: Find and set TDS/TCS ledger ID when TDS/TCS is selected
    if (TDSorTCS && tdsTcsAmount > 0) {
      // Search for the appropriate TDS/TCS ledger
      const ledgerNameToFind =
        TDSorTCS === "TDS" ? "TDS on Cash Withdrawn/Deposited" : "TCS";

      // Find the ledger with exact name match
      let tdsTcsLedgerToUpdate = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: { $regex: new RegExp(`^${ledgerNameToFind}$`, "i") },
      }).session(session);

      if (!tdsTcsLedgerToUpdate) {
        throw new Error(
          `${ledgerNameToFind} Ledger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      existingContra.TDSorTCSLedgerId = tdsTcsLedgerToUpdate._id.toString();
    } else {
      existingContra.TDSorTCSLedgerId = null;
    }

    existingContra.totalAmountOfDebit = totalAmountOfDebit;
    existingContra.totalAmountOfCredit = totalAmountOfCredit;
    existingContra.status = status || existingContra.status;

    await existingContra.save({ session });

    // --- Step C: Apply new balances ---
    const ledgerMap = aggregateAmountsByLedger(existingContra.itemDetails);
    const cashAccountMap = aggregateCashAccountAmounts(
      existingContra.itemDetails
    );

    // Remove old entries if ledger/cash/TDS changed or removed
    for (const oldLedgerId of oldLedgerIds) {
      if (!ledgerMap.has(oldLedgerId))
        await removeContraEntryFromLedger(
          schoolId,
          academicYear,
          id,
          oldLedgerId,
          session
        );
    }
    for (const oldCashId of oldCashAccountIds) {
      if (!cashAccountMap.has(oldCashId))
        await removeContraEntryFromLedger(
          schoolId,
          academicYear,
          id,
          oldCashId,
          session
        );
    }
    if (
      oldTDSorTCSId &&
      (!TDSorTCS ||
        oldTDSorTCSId !== existingContra.TDSorTCSLedgerId?.toString())
    ) {
      await removeContraEntryFromLedger(
        schoolId,
        academicYear,
        id,
        oldTDSorTCSId,
        session
      );
    }

    // Apply updated balances
    if (contraEntryName === "Cash Deposited") {
      for (const [ledgerId, amounts] of ledgerMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          entryDate,
          id,
          amounts.debitAmount,
          0,
          session
        );
      }
      for (const [cashAccountId, amounts] of cashAccountMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          cashAccountId,
          entryDate,
          id,
          0,
          amounts.creditAmount,
          session
        );
      }
    } else if (contraEntryName === "Cash Withdrawn") {
      for (const [ledgerId, amounts] of ledgerMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          entryDate,
          id,
          0,
          amounts.creditAmount,
          session
        );
      }
      for (const [cashAccountId, amounts] of cashAccountMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          cashAccountId,
          entryDate,
          id,
          amounts.debitAmount,
          0,
          session
        );
      }
    } else if (contraEntryName === "Bank Transfer") {
      for (const [ledgerId, amounts] of ledgerMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          ledgerId,
          entryDate,
          id,
          amounts.debitAmount,
          amounts.creditAmount,
          session
        );
      }
      for (const [cashAccountId, amounts] of cashAccountMap.entries()) {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          cashAccountId,
          entryDate,
          id,
          amounts.debitAmount,
          amounts.creditAmount,
          session
        );
      }
    }

    // Handle TDS/TCS ledger
    if (TDSorTCS && existingContra.TDSorTCSLedgerId) {
      const TDSLedgerId = existingContra.TDSorTCSLedgerId.toString();
      if (TDSorTCS === "TDS") {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSLedgerId,
          entryDate,
          id,
          parseFloat(TDSTCSRateAmount) || 0,
          0,
          session
        );
      } else if (TDSorTCS === "TCS") {
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSLedgerId,
          entryDate,
          id,
          0,
          parseFloat(TDSTCSRateAmount) || 0,
          session
        );
      }
    }

    const allLedgerIds = new Set([
      ...Array.from(ledgerMap.keys()),
      ...Array.from(cashAccountMap.keys()),
      ...(existingContra.TDSorTCSLedgerId
        ? [existingContra.TDSorTCSLedgerId.toString()]
        : []),
    ]);

    for (const ledgerId of allLedgerIds) {
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        ledgerId,
        entryDate,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      hasError: false,
      message: "Contra updated successfully!",
      data: existingContra,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating contra entry:", error);
    res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
};

export default updateById;
