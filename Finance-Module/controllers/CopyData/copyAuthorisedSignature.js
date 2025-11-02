import AuthorisedSignature from "../../models/AuthorisedSignature.js";

const copyAuthorisedSignatures = async (
  schoolId,
  newFinancialYear,
  prevFinancialYear,
  session
) => {
  const previousAuthorisedSignatures = await AuthorisedSignature.find({
    schoolId,
    financialYear: prevFinancialYear,
  }).session(session);

  const newAuthorisedSignatures = previousAuthorisedSignatures.map(
    (signature) => ({
      schoolId: signature.schoolId,
      authorisedSignatureImage: signature.authorisedSignatureImage,
      financialYear: newFinancialYear,
    })
  );

  if (newAuthorisedSignatures.length > 0) {
    await AuthorisedSignature.insertMany(newAuthorisedSignatures, { session });
  }

  return newAuthorisedSignatures.length;
};

export default copyAuthorisedSignatures;
