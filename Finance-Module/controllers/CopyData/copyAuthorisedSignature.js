import AuthorisedSignature from "../../models/AuthorisedSignature.js";

const copyAuthorisedSignatures = async (
  schoolId,
  newAcademicYear,
  prevAcademicYear,
  session
) => {
  const previousAuthorisedSignatures = await AuthorisedSignature.find({
    schoolId,
    academicYear: prevAcademicYear,
  }).session(session);

  const newAuthorisedSignatures = previousAuthorisedSignatures.map(
    (signature) => ({
      schoolId: signature.schoolId,
      authorisedSignatureImage: signature.authorisedSignatureImage,
      academicYear: newAcademicYear,
    })
  );

  if (newAuthorisedSignatures.length > 0) {
    await AuthorisedSignature.insertMany(newAuthorisedSignatures, { session });
  }

  return newAuthorisedSignatures.length;
};

export default copyAuthorisedSignatures;
