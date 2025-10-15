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
  debitAmount = toTwoDecimals(debitAmount);
  creditAmount = toTwoDecimals(creditAmount);

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

  let effectiveOpeningBalance = toTwoDecimals(openingBalance);

  if (previousBalanceDetails.length > 0) {
    effectiveOpeningBalance = toTwoDecimals(
      previousBalanceDetails[0].closingBalance
    );
  }

  // Calculate closing balance
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
    const amountAfterGST = toTwoDecimals(item.amountAfterGST) || 0;

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

    const transactionNumber =
      paymentMode === "Online" ? await generateTransactionNumber() : null;

    let TDSorTCSLedgerId = null;
    const tdsTcsAmount = Number(TDSTCSRateWithAmountBeforeGST) || 0;

    if (TDSorTCS && tdsTcsAmount > 0) {
      // Search for "TDS on Receipts" or "TCS on Receipts" ledger
      const ledgerNameToFind =
        TDSorTCS === "TDS" ? "TDS Deducted" : "TCS Deducted";

      // Find the ledger with exact name match
      let tdsTcsLedgerToUpdate = await Ledger.findOne({
        schoolId,
        academicYear,
        ledgerName: { $regex: new RegExp(`^${ledgerNameToFind}$`, "i") },
      });

      if (!tdsTcsLedgerToUpdate) {
        throw new Error(
          `${ledgerNameToFind} Ledger not found for school ${schoolId} and academic year ${academicYear}`
        );
      }

      TDSorTCSLedgerId = tdsTcsLedgerToUpdate._id.toString();
    }

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
      TDSorTCSLedgerId,
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

    if (TDSorTCS && tdsTcsAmount > 0 && TDSorTCSLedgerId) {
      if (TDSorTCS === "TDS") {
        // For TDS: Debit the TDS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSorTCSLedgerId,
          entryDate,
          newPaymentEntry._id,
          0, // debit
          tdsTcsAmount
          // credit
        );
      } else if (TDSorTCS === "TCS") {
        // For TCS: Credit the TCS ledger
        await updateOpeningClosingBalance(
          schoolId,
          academicYear,
          TDSorTCSLedgerId,
          entryDate,
          newPaymentEntry._id,
          tdsTcsAmount, // debit
          0 // credit
        );
      }

      ledgerIdsToUpdate.add(TDSorTCSLedgerId);
    }

    // 3. Payment Mode Ledger (Credit)
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

    // Get all unique ledger IDs from itemDetails
    const uniqueLedgerIds = [
      ...new Set(updatedItemDetails.map((item) => item.ledgerId)),
    ];

    // Find ledgers with their Head of Account information
    const ledgers = await Ledger.find({
      _id: { $in: uniqueLedgerIds },
    }).populate("headOfAccountId");

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

    // i want that after above things done then agin in table OpeningClosingBalance
    // i want to find that if there is any ledgerId whose ledgerName is "Net Surplus/(Deficit)"
    // if no then create one entry with that perticular ledgerId and
    // if item.ledgerId having headOfAccount "Income" or headOfAccount "Expenses"
    // then opening closing balance table store in "debit" : amountAfterGST
    // credit will be 0 and closing Balance ---> opening +debit - credit
    // if first entry then there will be no opening balance so you can store 0 as opening balance
    // and other things debit=amountAfterGSt
    // credit = 0 and
    // example : closingBalance = 0+100-0= 100
    //

    // if second entry then for opening Balance you can use previous date's or previous entries
    // closingBalance as opening balance
    // and can store openingBalance = 100
    // debitAmount = example amountAfterGSt =200
    // creditAmount= 0
    // example : closingBalance = 100+200-0= 300

    //if having both income and expenses then for that ledger i need to do it like incomeBalance - expense balance
    // so which ever has ledgrId with income and whichever has ledgrId with expenses
    // then you need to do income-expenses

    // enrty  enrtyDate   HeadofAccount	BS&P&LLedger	GroupLedger	             Ledger.          OpeningBalance. debit credit ClosingBalance
    // enrty1 01-01-2025  Income         School Fees   LateFees and ExcessFees  ExcessFees.     0.              100.   0.     100
    // enrty2 01-01-2025  Income         School   Fees   LateFees and ExcessFees  ExcessFees.     100             200.   0.     300

    // if any entry have both income and expenses and both having  amountAfterGSt.                amountAfterGST
    // enrty  enrtyDate   HeadofAccount	BS&P&LLedger	 GroupLedger	             Ledger.
    // enrty3 01-01-2025  Income        School Fees     LateFees and ExcessFees  ExcessFees.      200
    // enrty3 01-01-2025  Expenses      Administration  Charity&Gifts            Donation.        100

    // for entry1 for  "Net Surplus/(Deficit)". you need to store it like
    // enrty  enrtyDate   HeadofAccount.        	BS&P&LLedger	           GroupLedger	            Ledger.                  OpeningBalance. debit credit ClosingBalance
    // enrty1 01-01-2025  Net Surplus/(Deficit)	  Net Surplus/(Deficit)	   Net Surplus/(Deficit)	  Net Surplus/(Deficit)	     0.            100.   0.     100
    // enrty2 01-01-2025  Net Surplus/(Deficit)	  Net Surplus/(Deficit)	   Net Surplus/(Deficit)	  Net Surplus/(Deficit)	    100            200    0.     300
    // enrty3 01-01-2025  Net Surplus/(Deficit)	  Net Surplus/(Deficit)	   Net Surplus/(Deficit)	  Net Surplus/(Deficit)	    300            100    0.     400

    // Add this code right after await totalNetRecord.save({ session });

    // see if i have 2 item.ledgrId one with income and having amountAfterGST  100
    // and another with having expenses amountAfterGST 40 then it must store
    // income - expenses = 100-40 = 60
    // then it must store 60 but currently it is storing 140 in debit why

    const netSurplusDeficitLedger = await Ledger.findOne({
      schoolId,
      academicYear,
      ledgerName: "Net Surplus/(Deficit)",
    }).session(session);

    if (!netSurplusDeficitLedger) {
      throw new Error("Net Surplus/(Deficit) ledger not found");
    }

    // Calculate net amount for this payment entry (income - expenses)
    let netAmount = 0;

    // Calculate net amount based on Head of Account from the itemDetails
    for (const item of updatedItemDetails) {
      const ledger = ledgers.find(
        (l) => l._id.toString() === item.ledgerId.toString()
      );

      if (ledger && ledger.headOfAccountId) {
        const headOfAccountName = ledger.headOfAccountId.headOfAccountName;
        const amountAfterGST = parseFloat(item.amountAfterGST) || 0;

        if (headOfAccountName.toLowerCase() === "income") {
          netAmount += amountAfterGST;
        } else if (headOfAccountName.toLowerCase() === "expenses") {
          netAmount += amountAfterGST;
        }
      }
    }

    netAmount = toTwoDecimals(netAmount);

    // Only proceed if there's actually income or expense entries
    if (netAmount !== 0) {
      // Update OpeningClosingBalance for Net Surplus/(Deficit) ledger
      await updateOpeningClosingBalance(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
        entryDate,
        newPaymentEntry._id,
        netAmount > 0 ? netAmount : 0, // debit if positive
        netAmount < 0 ? Math.abs(netAmount) : 0 // credit if negative
      );

      // Recalculate balances for Net Surplus/(Deficit) ledger
      await recalculateLedgerBalances(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id
      );
      await recalculateAllBalancesAfterDate(
        schoolId,
        academicYear,
        netSurplusDeficitLedger._id,
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
