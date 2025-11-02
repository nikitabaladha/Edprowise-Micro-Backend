import BSPLLedger from "../../models/BSPLLedger.js";
import HeadOfAccount from "../../models/HeadOfAccount.js";

const copyBSPLLedgers = async (
  schoolId,
  newFinancialYear,
  prevFinancialYear,
  session
) => {
  const previousBSPLLedgers = await BSPLLedger.find({
    schoolId,
    financialYear: prevFinancialYear,
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
    financialYear: prevFinancialYear,
  }).session(session);

  const newHeadOfAccounts = await HeadOfAccount.find({
    schoolId,
    financialYear: newFinancialYear,
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
      financialYear: newFinancialYear,
    });
  }

  if (newBSPLLedgers.length > 0) {
    await BSPLLedger.insertMany(newBSPLLedgers, { session });
  }

  return newBSPLLedgers.length;
};

export default copyBSPLLedgers;
