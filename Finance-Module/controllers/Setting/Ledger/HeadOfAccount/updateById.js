import HeadOfAccount from "../../../../models/HeadOfAccount.js";
import HeadOfAccountValidator from "../../../../validators/HeadOfAccountValidator.js";

async function update(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: Unauthorized request.",
      });
    }

    const { id, financialYear } = req.params;

    const existingHead = await HeadOfAccount.findOne({
      _id: id,
      schoolId,
      financialYear,
    });
    if (!existingHead) {
      return res.status(404).json({
        hasError: true,
        message: "Head Of Account not found.",
      });
    }

    const { headOfAccountName } = req.body;

    if (headOfAccountName) {
      const { error } =
        HeadOfAccountValidator.HeadOfAccountValidatorUpdate.validate({
          headOfAccountName,
          financialYear,
        });

      if (error) {
        const errorMessages = error.details
          .map((err) => err.message)
          .join(", ");
        return res.status(400).json({
          hasError: true,
          message: errorMessages,
        });
      }

      existingHead.headOfAccountName = headOfAccountName;
    }

    await existingHead.save();

    return res.status(200).json({
      hasError: false,
      message: "Head Of Account updated successfully.",
      data: existingHead,
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

    console.error("Error updating Head Of Account:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default update;
