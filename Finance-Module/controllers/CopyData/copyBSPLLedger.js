// import BSPLLedger from "../../models/BSPLLedger.js";

// const copyBSPLLedgers = async (
//   schoolId,
//   newAcademicYear,
//   prevAcademicYear,
//   session
// ) => {
//   const previousBSPLLedgers = await BSPLLedger.find({
//     schoolId,
//     academicYear: prevAcademicYear,
//   }).session(session);

//   // at time of copying head of account Id in newBSPLLedgers i want to copy headOfAccountId of newlycreated year

//   const newBSPLLedgers = previousBSPLLedgers.map((ledger) => ({
//     schoolId,
//     headOfAccountId: ledger.headOfAccountId,
//     bSPLLedgerName: ledger.bSPLLedgerName,
//     academicYear: newAcademicYear,
//   }));

//   if (newBSPLLedgers.length > 0) {
//     await BSPLLedger.insertMany(newBSPLLedgers, { session });
//   }

//   return newBSPLLedgers.length;
// };

// export default copyBSPLLedgers;

import BSPLLedger from "../../models/BSPLLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";

const copyBSPLLedgers = async (
  schoolId,
  newAcademicYear,
  prevAcademicYear,
  session
) => {
  const previousBSPLLedgers = await BSPLLedger.find({
    schoolId,
    academicYear: prevAcademicYear,
  }).session(session);

  if (previousBSPLLedgers.length === 0) {
    return 0;
  }

  const prevHeadOfAccountIds = previousBSPLLedgers.map(
    (l) => l.headOfAccountId
  );
  const prevHeadOfAccounts = await HeadOfAccount.find({
    _id: { $in: prevHeadOfAccountIds },
    schoolId,
    academicYear: prevAcademicYear,
  }).session(session);

  const newHeadOfAccounts = await HeadOfAccount.find({
    schoolId,
    academicYear: newAcademicYear,
  }).session(session);

  const headOfAccountNameToNewId = {};
  newHeadOfAccounts.forEach((hoa) => {
    headOfAccountNameToNewId[hoa.headOfAccountName] = hoa._id;
  });

  const newBSPLLedgers = [];
  for (const prevLedger of previousBSPLLedgers) {
    const prevHoa = prevHeadOfAccounts.find((hoa) =>
      hoa._id.equals(prevLedger.headOfAccountId)
    );

    if (!prevHoa) continue;

    const newHeadOfAccountId =
      headOfAccountNameToNewId[prevHoa.headOfAccountName];
    if (!newHeadOfAccountId) continue;

    newBSPLLedgers.push({
      schoolId,
      headOfAccountId: newHeadOfAccountId,
      bSPLLedgerName: prevLedger.bSPLLedgerName,
      academicYear: newAcademicYear,
    });
  }

  if (newBSPLLedgers.length > 0) {
    await BSPLLedger.insertMany(newBSPLLedgers, { session });
  }

  return newBSPLLedgers.length;
};

export default copyBSPLLedgers;
