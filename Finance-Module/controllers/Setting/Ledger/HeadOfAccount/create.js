import HeadOfAccount from "../../../../models/HeadOfAccount.js";
import HeadOfAccountValidator from "../../../../validators/HeadOfAccountValidator.js";

async function create(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to request for a quote.",
      });
    }

    const { error } = HeadOfAccountValidator.HeadOfAccountValidator.validate(
      req.body
    );
    if (error) {
      const errorMessages = error.details.map((err) => err.message).join(", ");
      return res.status(400).json({
        hasError: true,
        message: errorMessages,
      });
    }

    const { headOfAccountName, academicYear } = req.body;

    const newHeadOfAccount = new HeadOfAccount({
      schoolId,
      headOfAccountName,
      academicYear,
    });

    await newHeadOfAccount.save();

    return res.status(201).json({
      hasError: false,
      message: "Head Of Account Name Created successfully!",
      data: newHeadOfAccount,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)
        .map((key) => `${key}: ${error.keyValue[key]}`)
        .join(", ");
      return res.status(400).json({
        hasError: true,
        message: `Duplicate entry for ${field}. Head Of Accounnt already exists.`,
      });
    }

    console.error("Error Creating Head Of Account:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
