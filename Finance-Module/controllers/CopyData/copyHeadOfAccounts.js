import HeadOfAccount from "../../models/HeadOfAccount.js";

const copyHeadOfAccounts = async (
  schoolId,
  newFinancialYear,
  prevFinancialYear,
  session
) => {
  const previousHeadOfAccounts = await HeadOfAccount.find({
    schoolId,
    financialYear: prevFinancialYear,
  }).session(session);

  const newHeadOfAccounts = previousHeadOfAccounts.map((headOfAccount) => ({
    schoolId,
    headOfAccountName: headOfAccount.headOfAccountName,
    financialYear: newFinancialYear,
  }));

  if (newHeadOfAccounts.length > 0) {
    await HeadOfAccount.insertMany(newHeadOfAccounts, { session });
  }

  return newHeadOfAccounts.length;
};

export default copyHeadOfAccounts;
