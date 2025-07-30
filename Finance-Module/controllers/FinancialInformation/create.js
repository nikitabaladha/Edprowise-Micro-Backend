import FinancialInformation from "../../models/FinancialInformation.js";
import FinancialInformationValidator from "../../validators/FinancialInformationValidator.js";

export async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: You do not have permission.",
      });
    }

    const { error } =
      FinancialInformationValidator.FinancialInformationValidator.validate(
        req.body
      );
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const { openingBalance, paymentTerms, academicYear } = req.body;

    const { documentImage } = req.files || {};

    const documentImagePath = documentImage?.[0]?.mimetype.startsWith("image/")
      ? "/Images/FinanceModule/DocumentImageForFinancialInformation"
      : "/Documents/FinanceModule/DocumentImageForFinancialInformation";

    const documentImageFullPath = documentImage?.[0]
      ? `${documentImagePath}/${documentImage[0].filename}`
      : null;

    const newFinancialInformation = new FinancialInformation({
      schoolId,
      documentImage: documentImageFullPath,
      academicYear,
      openingBalance,
      paymentTerms,
    });

    await newFinancialInformation.save();

    return res.status(201).json({
      hasError: false,
      message: "FinancialInformation created successfully!",
      data: newFinancialInformation,
    });
  } catch (error) {
    console.error("Error creating FinancialInformation:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default create;
