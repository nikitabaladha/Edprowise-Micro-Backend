import HeadOfAccount from "../../models/HeadOfAccount.js";

const copyHeadOfAccounts = async (
  schoolId,
  newAcademicYear,
  prevAcademicYear,
  session
) => {
  const previousHeadOfAccounts = await HeadOfAccount.find({
    schoolId,
    academicYear: prevAcademicYear,
  }).session(session);

  const newHeadOfAccounts = previousHeadOfAccounts.map((headOfAccount) => ({
    schoolId,
    headOfAccountName: headOfAccount.headOfAccountName,
    academicYear: newAcademicYear,
  }));

  if (newHeadOfAccounts.length > 0) {
    await HeadOfAccount.insertMany(newHeadOfAccounts, { session });
  }

  return newHeadOfAccounts.length;
};

export default copyHeadOfAccounts;
