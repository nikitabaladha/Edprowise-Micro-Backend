import HeadOfAccount from "../../../../models/HeadOfAccount.js";
import HeadOfAccountValidator from "../../../../validators/HeadOfAccountValidator.js";

async function update(req, res) {
  try {
    const { id } = req.params;

    const existingHead = await HeadOfAccount.findById(id);
    if (!existingHead) {
      return res.status(404).json({
        hasError: true,
        message: "Head Of Account not found.",
      });
    }

    const { headOfAccountName } = req.body;

    if (headOfAccountName) {
      const { error } = HeadOfAccountValidator.HeadOfAccountValidator.validate({
        headOfAccountName,
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

      const duplicate = await HeadOfAccount.findOne({
        headOfAccountName: headOfAccountName,
        _id: { $ne: id },
      });

      if (duplicate) {
        return res.status(400).json({
          hasError: true,
          message: "A Head Of Account with this Name already exists.",
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
    console.error("Error updating Head Of Account:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default update;
