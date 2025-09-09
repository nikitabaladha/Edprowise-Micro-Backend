import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import Ledger from "../../models/Ledger.js";
import moment from "moment";

async function getAllOpeningClosingBalanceBySchoolId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    const { ledgerId, startDate, endDate, academicYear } = req.query;

    // Validate required parameters
    if (!ledgerId || !academicYear) {
      return res.status(400).json({
        hasError: true,
        message: "ledgerId and academicYear are required parameters.",
      });
    }

    // Get the ledger details including opening balance
    const ledger = await Ledger.findOne({
      schoolId,
      _id: ledgerId,
      academicYear,
    });

    if (!ledger) {
      return res.status(404).json({
        hasError: true,
        message: "Ledger not found for the given academic year.",
      });
    }

    // Get the opening closing balance record
    const openingClosingBalance = await OpeningClosingBalance.findOne({
      schoolId,
      ledgerId,
      academicYear,
    }).populate("ledgerId", "ledgerName");

    // Parse date range or use academic year range
    const academicYearStart = moment(
      `04/01/${academicYear.split("-")[0]}`,
      "MM/DD/YYYY"
    ).startOf("day");
    const academicYearEnd = moment(
      `03/31/${academicYear.split("-")[1]}`,
      "MM/DD/YYYY"
    ).endOf("day");

    // Normalize query range
    const start = startDate
      ? moment(startDate).startOf("day")
      : academicYearStart.clone();
    const end = endDate
      ? moment(endDate).endOf("day")
      : academicYearEnd.clone();

    // Build day list with day granularity
    const allDates = [];
    let currentDate = start.clone();
    while (currentDate.isSameOrBefore(end, "day")) {
      allDates.push(currentDate.clone());
      currentDate.add(1, "day");
    }

    // ----- Initial balance up to the day BEFORE start -----
    let initialBalance = ledger.openingBalance;
    if (
      openingClosingBalance &&
      openingClosingBalance.balanceDetails.length > 0
    ) {
      const preStartDate = start.clone().subtract(1, "day"); // 1 day before start

      const transactionsBeforeStartDate = openingClosingBalance.balanceDetails
        .filter((d) => moment(d.entryDate).isSameOrBefore(preStartDate, "day")) // <- compare by 'day'
        .sort((a, b) => moment(a.entryDate).diff(moment(b.entryDate)));

      for (const t of transactionsBeforeStartDate) {
        const debit = Number(t.debit) || 0;
        const credit = Number(t.credit) || 0;
        initialBalance =
          ledger.balanceType === "Debit"
            ? initialBalance + debit - credit
            : initialBalance + debit - credit;
      }
    }

    // ----- Daily processing with day granularity -----
    const dailyBalances = [];
    let currentBalance = initialBalance;

    if (
      openingClosingBalance &&
      openingClosingBalance.balanceDetails.length > 0
    ) {
      const sortedTransactions = openingClosingBalance.balanceDetails
        .map((d) => ({
          ...d,
          entryDateMoment: moment(d.entryDate).startOf("day"),
          debit: d.debit || 0,
          credit: d.credit || 0,
        }))
        .sort((a, b) => a.entryDateMoment.diff(b.entryDateMoment));

      let transactionIndex = 0;

      for (const date of allDates) {
        const transactionsForDate = [];

        while (transactionIndex < sortedTransactions.length) {
          const t = sortedTransactions[transactionIndex];

          if (t.entryDateMoment.isSame(date, "day")) {
            transactionsForDate.push(t);
            transactionIndex++;
          } else if (t.entryDateMoment.isAfter(date, "day")) {
            break; // later date
          } else {
            transactionIndex++; // before current date (already in initialBalance)
          }
        }

        if (transactionsForDate.length > 0) {
          const dayDebit = transactionsForDate.reduce(
            (s, t) => s + (Number(t.debit) || 0),
            0
          );
          const dayCredit = transactionsForDate.reduce(
            (s, t) => s + (Number(t.credit) || 0),
            0
          );

          const openingBalance = currentBalance;
          currentBalance =
            ledger.balanceType === "Debit"
              ? openingBalance + dayDebit - dayCredit
              : openingBalance + dayDebit - dayCredit;

          dailyBalances.push({
            entryDate: date.toDate(),
            openingBalance,
            debit: dayDebit,
            credit: dayCredit,
            closingBalance: currentBalance,
          });
        } else {
          dailyBalances.push({
            entryDate: date.toDate(),
            openingBalance: currentBalance,
            debit: 0,
            credit: 0,
            closingBalance: currentBalance,
          });
        }
      }
    } else {
      for (const date of allDates) {
        dailyBalances.push({
          entryDate: date.toDate(),
          openingBalance: currentBalance,
          debit: 0,
          credit: 0,
          closingBalance: currentBalance,
        });
      }
    }

    return res.status(200).json({
      hasError: false,
      message: "Opening Closing Balance fetched successfully",
      data: [
        {
          _id: openingClosingBalance ? openingClosingBalance._id : null,
          schoolId,
          academicYear,
          ledgerId: ledger._id,
          ledgerName: ledger.ledgerName,
          balanceDetails: dailyBalances,
          balanceType: ledger.balanceType,
        },
      ],
    });
  } catch (error) {
    console.error("Error fetching Opening Closing Balance:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getAllOpeningClosingBalanceBySchoolId;
