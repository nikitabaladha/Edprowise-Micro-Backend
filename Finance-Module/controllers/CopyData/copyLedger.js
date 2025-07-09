// import Ledger from "../../models/Ledger.js";

// const copyLedgers = async (
//   schoolId,
//   newAcademicYear,
//   prevAcademicYear,
//   session
// ) => {
//   const previousLedgers = await Ledger.find({
//     schoolId,
//     academicYear: prevAcademicYear,
//   }).session(session);

//   const newLedgers = previousLedgers.map((ledger) => ({
//     schoolId,
//     headOfAccountId: ledger.headOfAccountId,
//     groupLedgerId: ledger.groupLedgerId,
//     bSPLLedgerId: ledger.bSPLLedgerId,
//     ledgerName: ledger.ledgerName,
//     openingBalance: ledger.openingBalance,
//     paymentMode: ledger.paymentMode,
//     academicYear: newAcademicYear,
//   }));

//   if (newLedgers.length > 0) {
//     await Ledger.insertMany(newLedgers, { session });
//   }

//   return newLedgers.length;
// };

// export default copyLedgers;

import Ledger from "../../models/Ledger.js";
import GroupLedger from "../../models/GroupLedger.js";
import BSPLLedger from "../../models/BSPLLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";

const copyLedgers = async (
  schoolId,
  newAcademicYear,
  prevAcademicYear,
  session
) => {
  // 1. Get all previous Ledgers
  const previousLedgers = await Ledger.find({
    schoolId,
    academicYear: prevAcademicYear,
  }).session(session);

  if (previousLedgers.length === 0) {
    return 0;
  }

  // 2. Get all referenced documents from previous year
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

  // 3. Get all new documents for the current year
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

  // 4. Create mappings from old to new IDs
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

  // 5. Create new Ledgers with updated references
  const newLedgers = [];
  for (const prevLedger of previousLedgers) {
    // Find previous references
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

    // Find new references
    const newHeadOfAccountId = headOfAccountMap[prevHoa.headOfAccountName];
    const newGroupLedgerId = groupLedgerMap[prevGroup.groupLedgerName];
    const newBSPLLedgerId = bsplLedgerMap[prevBspl.bSPLLedgerName];

    if (!newHeadOfAccountId || !newGroupLedgerId || !newBSPLLedgerId) continue;

    newLedgers.push({
      schoolId,
      headOfAccountId: newHeadOfAccountId,
      groupLedgerId: newGroupLedgerId,
      bSPLLedgerId: newBSPLLedgerId,
      ledgerName: prevLedger.ledgerName,
      openingBalance: prevLedger.openingBalance,
      paymentMode: prevLedger.paymentMode,
      academicYear: newAcademicYear,
    });
  }

  // 6. Insert the new Ledgers
  if (newLedgers.length > 0) {
    await Ledger.insertMany(newLedgers, { session });
  }

  return newLedgers.length;
};

export default copyLedgers;
