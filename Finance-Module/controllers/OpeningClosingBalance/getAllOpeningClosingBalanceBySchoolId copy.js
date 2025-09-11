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
    );
    const academicYearEnd = moment(
      `03/31/${academicYear.split("-")[1]}`,
      "MM/DD/YYYY"
    );

    const start = startDate ? moment(startDate) : academicYearStart;
    const end = endDate ? moment(endDate) : academicYearEnd;

    // Generate all dates in the range
    const allDates = [];
    let currentDate = moment(start);
    while (currentDate.isSameOrBefore(end)) {
      allDates.push(moment(currentDate));
      currentDate.add(1, "day");
    }

    // Generate daily balances
    const dailyBalances = [];
    let currentBalance = ledger.openingBalance;

    // If we have transactions, process them
    if (
      openingClosingBalance &&
      openingClosingBalance.balanceDetails.length > 0
    ) {
      console.log(
        "Found transactions:",
        openingClosingBalance.balanceDetails.length
      );

      // Sort transaction details by date
      const sortedTransactions = openingClosingBalance.balanceDetails
        .map((detail) => ({
          ...detail,
          // Convert to moment object for proper date comparison
          entryDateMoment: moment(detail.entryDate),
          // Ensure debit and credit have proper values
          debit: detail.debit || 0,
          credit: detail.credit || 0,
        }))
        .sort((a, b) => a.entryDateMoment - b.entryDateMoment);

      console.log(
        "Sorted transactions:",
        sortedTransactions.map((t) => ({
          date: t.entryDateMoment.format("YYYY-MM-DD"),
          debit: t.debit,
          credit: t.credit,
        }))
      );

      let transactionIndex = 0;

      for (const date of allDates) {
        const currentDateFormatted = date.format("YYYY-MM-DD");
        console.log("Processing date:", currentDateFormatted);

        // Check if we have transactions for this date
        const transactionsForDate = [];

        // Find all transactions for this specific date
        while (transactionIndex < sortedTransactions.length) {
          const transaction = sortedTransactions[transactionIndex];
          const transactionDateFormatted =
            transaction.entryDateMoment.format("YYYY-MM-DD");

          console.log(
            "Comparing with transaction:",
            transactionDateFormatted,
            "debit:",
            transaction.debit,
            "credit:",
            transaction.credit
          );

          if (transactionDateFormatted === currentDateFormatted) {
            console.log("MATCH FOUND for date:", currentDateFormatted);
            transactionsForDate.push(transaction);
            transactionIndex++;
          } else if (transaction.entryDateMoment.isAfter(date)) {
            // We've passed the current date, break the loop
            console.log("Transaction is after current date, breaking");
            break;
          } else {
            // Transaction is before current date, skip it
            console.log("Transaction is before current date, skipping");
            transactionIndex++;
          }
        }

        console.log(
          "Transactions for date",
          currentDateFormatted,
          ":",
          transactionsForDate.length
        );

        // Calculate daily totals if we have transactions
        if (transactionsForDate.length > 0) {
          const dayDebit = transactionsForDate.reduce(
            (sum, t) => sum + (Number(t.debit) || 0),
            0
          );
          const dayCredit = transactionsForDate.reduce(
            (sum, t) => sum + (Number(t.credit) || 0),
            0
          );

          const openingBalance = currentBalance;

          // Calculate closing balance based on ledger type
          if (ledger.balanceType === "Debit") {
            currentBalance = openingBalance + dayDebit - dayCredit;
          } else {
            // For Credit balance type: openingBalance - debit + credit
            currentBalance = openingBalance + dayDebit - dayCredit;
          }

          console.log(
            "Adding transaction data for date:",
            currentDateFormatted,
            {
              openingBalance,
              debit: dayDebit,
              credit: dayCredit,
              closingBalance: currentBalance,
            }
          );

          dailyBalances.push({
            entryDate: date.utc().toDate(),
            // entryDate: moment(date).startOf("day").toDate(),
            openingBalance,
            debit: dayDebit,
            credit: dayCredit,
            closingBalance: currentBalance,
          });
        } else {
          // No transactions for this date, carry forward the balance
          console.log(
            "No transactions for date:",
            currentDateFormatted,
            "carrying forward:",
            currentBalance
          );
          dailyBalances.push({
            entryDate: date.utc().toDate(),
            // entryDate: moment(date).startOf("day").toDate(),
            openingBalance: currentBalance,
            debit: 0,
            credit: 0,
            closingBalance: currentBalance,
          });
        }
      }
    } else {
      // No transactions exist, return the opening balance for all dates
      console.log("No transactions found, returning default balances");
      for (const date of allDates) {
        dailyBalances.push({
          entryDate: date.utc().toDate(),
          // entryDate: moment(date).startOf("day").toDate(),
          openingBalance: currentBalance,
          debit: 0,
          credit: 0,
          closingBalance: currentBalance,
        });
      }
    }

    console.log("Final daily balances:", dailyBalances);

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
