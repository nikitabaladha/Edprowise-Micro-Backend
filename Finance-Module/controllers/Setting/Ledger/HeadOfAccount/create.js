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

    const { headOfAccountName } = req.body;

    const existingHeadOfAccountName = await HeadOfAccount.findOne({
      headOfAccountName,
    });
    if (existingHeadOfAccountName) {
      return res.status(400).json({
        hasError: true,
        message: "A Head Of Account with this Name already exists.",
      });
    }

    const newHeadOfAccount = new HeadOfAccount({ schoolId, headOfAccountName });

    await newHeadOfAccount.save();

    return res.status(201).json({
      hasError: false,
      message: "Head Of Account Name Created successfully!",
      data: newHeadOfAccount,
    });
  } catch (error) {
    console.error("Error Creating Head Of Account:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default create;
