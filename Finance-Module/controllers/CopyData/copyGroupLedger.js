// import GroupLedger from "../../models/GroupLedger.js";

// const copyGroupLedgers = async (
//   schoolId,
//   newAcademicYear,
//   prevAcademicYear,
//   session
// ) => {
//   const previousGroupLedgers = await GroupLedger.find({
//     schoolId,
//     academicYear: prevAcademicYear,
//   }).session(session);

//   const newGroupLedgers = previousGroupLedgers.map((ledger) => ({
//     schoolId,
//     headOfAccountId: ledger.headOfAccountId,
//     bSPLLedgerId: ledger.bSPLLedgerId,
//     groupLedgerName: ledger.groupLedgerName,
//     academicYear: newAcademicYear,
//   }));

//   if (newGroupLedgers.length > 0) {
//     await GroupLedger.insertMany(newGroupLedgers, { session });
//   }

//   return newGroupLedgers.length;
// };

// export default copyGroupLedgers;

import GroupLedger from "../../models/GroupLedger.js";
import BSPLLedger from "../../models/BSPLLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";

const copyGroupLedgers = async (
  schoolId,
  newAcademicYear,
  prevAcademicYear,
  session
) => {
  const previousGroupLedgers = await GroupLedger.find({
    schoolId,
    academicYear: prevAcademicYear,
  }).session(session);

  if (previousGroupLedgers.length === 0) {
    return 0;
  }

  const prevHeadOfAccountIds = previousGroupLedgers.map(
    (l) => l.headOfAccountId
  );
  const prevBSPLLedgerIds = previousGroupLedgers.map((l) => l.bSPLLedgerId);

  const [prevHeadOfAccounts, prevBSPLLedgers] = await Promise.all([
    HeadOfAccount.find({
      _id: { $in: prevHeadOfAccountIds },
      schoolId,
      academicYear: prevAcademicYear,
    }).session(session),
    BSPLLedger.find({
      _id: { $in: prevBSPLLedgerIds },
      schoolId,
      academicYear: prevAcademicYear,
    }).session(session),
  ]);

  const [newHeadOfAccounts, newBSPLLedgers] = await Promise.all([
    HeadOfAccount.find({
      schoolId,
      academicYear: newAcademicYear,
    }).session(session),
    BSPLLedger.find({
      schoolId,
      academicYear: newAcademicYear,
    }).session(session),
  ]);

  const headOfAccountNameToNewId = {};
  newHeadOfAccounts.forEach((hoa) => {
    headOfAccountNameToNewId[hoa.headOfAccountName] = hoa._id;
  });

  const bsplLedgerNameToNewId = {};
  newBSPLLedgers.forEach((ledger) => {
    bsplLedgerNameToNewId[ledger.bSPLLedgerName] = ledger._id;
  });

  const newGroupLedgers = [];
  for (const prevLedger of previousGroupLedgers) {
    const prevHoa = prevHeadOfAccounts.find((hoa) =>
      hoa._id.equals(prevLedger.headOfAccountId)
    );

    const prevBspl = prevBSPLLedgers.find((ledger) =>
      ledger._id.equals(prevLedger.bSPLLedgerId)
    );

    if (!prevHoa || !prevBspl) continue;

    const newHeadOfAccountId =
      headOfAccountNameToNewId[prevHoa.headOfAccountName];

    const newBSPLLedgerId = bsplLedgerNameToNewId[prevBspl.bSPLLedgerName];

    if (!newHeadOfAccountId || !newBSPLLedgerId) continue;

    newGroupLedgers.push({
      schoolId,
      headOfAccountId: newHeadOfAccountId,
      bSPLLedgerId: newBSPLLedgerId,
      groupLedgerName: prevLedger.groupLedgerName,
      academicYear: newAcademicYear,
    });
  }

  if (newGroupLedgers.length > 0) {
    await GroupLedger.insertMany(newGroupLedgers, { session });
  }

  return newGroupLedgers.length;
};

export default copyGroupLedgers;
