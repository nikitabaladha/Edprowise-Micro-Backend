import Ledger from "../../models/Ledger.js";
import GroupLedger from "../../models/GroupLedger.js";
import BSPLLedger from "../../models/BSPLLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";
import OpeningClosingBalance from "../../models/OpeningClosingBalance.js";

const copyLedgers = async (
  schoolId,
  newAcademicYear,
  prevAcademicYear,
  session
) => {
  const previousLedgers = await Ledger.find({
    schoolId,
    academicYear: prevAcademicYear,
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
        academicYear: prevAcademicYear,
      }).session(session),
      GroupLedger.find({
        _id: { $in: prevGroupLedgerIds },
        schoolId,
        academicYear: prevAcademicYear,
      }).session(session),
      BSPLLedger.find({
        _id: { $in: prevBSPLLedgerIds },
        schoolId,
        academicYear: prevAcademicYear,
      }).session(session),
    ]);

  const [newHeadOfAccounts, newGroupLedgers, newBSPLLedgers] =
    await Promise.all([
      HeadOfAccount.find({
        schoolId,
        academicYear: newAcademicYear,
      }).session(session),
      GroupLedger.find({
        schoolId,
        academicYear: newAcademicYear,
      }).session(session),
      BSPLLedger.find({
        schoolId,
        academicYear: newAcademicYear,
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
    academicYear: prevAcademicYear,
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

    newLedgers.push({
      schoolId,
      headOfAccountId: newHeadOfAccountId,
      groupLedgerId: newGroupLedgerId,
      bSPLLedgerId: newBSPLLedgerId,
      ledgerName: prevLedger.ledgerName,
      openingBalance: openingBalance,
      balanceType: balanceType,
      paymentMode: prevLedger.paymentMode,
      ledgerCode: prevLedger.ledgerCode,
      academicYear: newAcademicYear,
    });
  }

  if (newLedgers.length > 0) {
    await Ledger.insertMany(newLedgers, { session });
  }

  return newLedgers.length;
};

export default copyLedgers;
