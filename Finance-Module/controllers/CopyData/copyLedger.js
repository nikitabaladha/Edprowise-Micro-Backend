import Ledger from "../../models/Ledger.js";
import GroupLedger from "../../models/GroupLedger.js";
import BSPLLedger from "../../models/BSPLLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";
import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";
import TotalNetdeficitNetSurplus from "../../models/TotalNetdeficitNetSurplus.js";

const copyLedgers = async (
  schoolId,
  newFinancialYear,
  prevFinancialYear,
  session
) => {
  const previousLedgers = await Ledger.find({
    schoolId,
    financialYear: prevFinancialYear,
  }).session(session);

  if (previousLedgers.length === 0) {
    return 0;
  }

  const prevHeadOfAccountIds = [
    ...new Set(previousLedgers.map((l) => l.headOfAccountId)),
  ];
  const prevGroupLedgerIds = [
    ...new Set(previousLedgers.map((l) => l.groupLedgerId)),
  ];
  const prevBSPLLedgerIds = [
    ...new Set(previousLedgers.map((l) => l.bSPLLedgerId)),
  ];

  const [prevHeadOfAccounts, prevGroupLedgers, prevBSPLLedgers] =
    await Promise.all([
      HeadOfAccount.find({
        _id: { $in: prevHeadOfAccountIds },
        schoolId,
        financialYear: prevFinancialYear,
      }).session(session),
      GroupLedger.find({
        _id: { $in: prevGroupLedgerIds },
        schoolId,
        financialYear: prevFinancialYear,
      }).session(session),
      BSPLLedger.find({
        _id: { $in: prevBSPLLedgerIds },
        schoolId,
        financialYear: prevFinancialYear,
      }).session(session),
    ]);

  const [newHeadOfAccounts, newGroupLedgers, newBSPLLedgers] =
    await Promise.all([
      HeadOfAccount.find({
        schoolId,
        financialYear: newFinancialYear,
      }).session(session),
      GroupLedger.find({
        schoolId,
        financialYear: newFinancialYear,
      }).session(session),
      BSPLLedger.find({
        schoolId,
        financialYear: newFinancialYear,
      }).session(session),
    ]);

  const createNameToIdMap = (items, nameField) => {
    const map = {};
    items.forEach((item) => {
      map[item[nameField]] = item._id;
    });
    return map;
  };

  const headOfAccountMap = createNameToIdMap(
    newHeadOfAccounts,
    "headOfAccountName"
  );
  const groupLedgerMap = createNameToIdMap(newGroupLedgers, "groupLedgerName");
  const bsplLedgerMap = createNameToIdMap(newBSPLLedgers, "bSPLLedgerName");

  const prevLedgerIds = previousLedgers.map((l) => l._id);
  const prevOpeningClosingBalances = await OpeningClosingBalance.find({
    schoolId,
    financialYear: prevFinancialYear,
    ledgerId: { $in: prevLedgerIds },
  }).session(session);

  const ledgerClosingBalanceMap = {};
  prevOpeningClosingBalances.forEach((balance) => {
    if (balance.balanceDetails && balance.balanceDetails.length > 0) {
      const lastEntry =
        balance.balanceDetails[balance.balanceDetails.length - 1];
      ledgerClosingBalanceMap[balance.ledgerId.toString()] =
        lastEntry.closingBalance;
    } else {
      ledgerClosingBalanceMap[balance.ledgerId.toString()] = 0;
    }
  });

  const newLedgers = [];
  let netSurplusDeficitLedgerId = null;

  for (const prevLedger of previousLedgers) {
    const prevHoa = prevHeadOfAccounts.find((hoa) =>
      hoa._id.equals(prevLedger.headOfAccountId)
    );
    const prevGroup = prevGroupLedgers.find((group) =>
      group._id.equals(prevLedger.groupLedgerId)
    );
    const prevBspl = prevBSPLLedgers.find((bspl) =>
      bspl._id.equals(prevLedger.bSPLLedgerId)
    );

    if (!prevHoa || !prevGroup || !prevBspl) continue;

    const newHeadOfAccountId = headOfAccountMap[prevHoa.headOfAccountName];
    const newGroupLedgerId = groupLedgerMap[prevGroup.groupLedgerName];
    const newBSPLLedgerId = bsplLedgerMap[prevBspl.bSPLLedgerName];

    if (!newHeadOfAccountId || !newGroupLedgerId || !newBSPLLedgerId) continue;

    const prevLedgerIdStr = prevLedger._id.toString();
    const openingBalance =
      ledgerClosingBalanceMap[prevLedgerIdStr] !== undefined
        ? ledgerClosingBalanceMap[prevLedgerIdStr]
        : prevLedger.openingBalance;

    let balanceType;
    if (openingBalance < 0) {
      balanceType = "Credit";
    } else {
      balanceType = "Debit";
    }

    const newLedgerData = {
      schoolId,
      headOfAccountId: newHeadOfAccountId,
      groupLedgerId: newGroupLedgerId,
      bSPLLedgerId: newBSPLLedgerId,
      ledgerName: prevLedger.ledgerName,
      openingBalance: openingBalance,
      balanceType: balanceType,
      paymentMode: prevLedger.paymentMode,
      ledgerCode: prevLedger.ledgerCode,
      financialYear: newFinancialYear,
      parentLedgerId: prevLedger._id,
    };

    newLedgers.push(newLedgerData);

    // Track if this is the Net Surplus/(Deficit) ledger
    if (prevLedger.ledgerName === "Net Surplus/(Deficit)") {
      console.log(
        `Found Net Surplus/(Deficit) ledger to copy: ${prevLedger._id}`
      );
    }
  }

  let copiedCount = 0;
  if (newLedgers.length > 0) {
    const insertedLedgers = await Ledger.insertMany(newLedgers, { session });
    copiedCount = insertedLedgers.length;

    // Find the newly created Net Surplus/(Deficit) ledger and store in TotalNetdeficitNetSurplus
    const netSurplusLedger = insertedLedgers.find(
      (ledger) => ledger.ledgerName === "Net Surplus/(Deficit)"
    );

    if (netSurplusLedger) {
      await createTotalNetdeficitNetSurplusRecord(
        schoolId,
        newFinancialYear,
        netSurplusLedger._id,
        session
      );
    }
  }

  return copiedCount;
};

async function createTotalNetdeficitNetSurplusRecord(
  schoolId,
  financialYear,
  ledgerId,
  session = null
) {
  try {
    const saveOptions = session ? { session } : {};

    // Check if record already exists
    const existingRecord = await TotalNetdeficitNetSurplus.findOne({
      schoolId,
      financialYear,
      ledgerId,
    }).session(session || null);

    if (!existingRecord) {
      const totalNetdeficitNetSurplus = new TotalNetdeficitNetSurplus({
        schoolId,
        financialYear,
        ledgerId,
        balanceDetails: [], // Empty array as requested
      });

      await totalNetdeficitNetSurplus.save(saveOptions);
      console.log(
        `Created TotalNetdeficitNetSurplus record for copied ledger: ${ledgerId}`
      );
      return true;
    } else {
      console.log(
        `TotalNetdeficitNetSurplus record already exists for ledger: ${ledgerId}`
      );
      return false;
    }
  } catch (error) {
    if (error.code === 11000) {
      console.log(
        `TotalNetdeficitNetSurplus record already exists (duplicate key)`
      );
      return false;
    }
    console.error("Error creating TotalNetdeficitNetSurplus record:", error);
    throw error;
  }
}

export default copyLedgers;
