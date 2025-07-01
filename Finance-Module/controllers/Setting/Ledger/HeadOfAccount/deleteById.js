import HeadOfAccount from "../../../../models/HeadOfAccount.js";

async function deleteHeadOfAccount(req, res) {
  try {
    const { id } = req.params;

    const existingHead = await HeadOfAccount.findById(id);
    if (!existingHead) {
      return res.status(404).json({
        hasError: true,
        message: "Head Of Account not found.",
      });
    }

    await HeadOfAccount.findByIdAndDelete(id);

    return res.status(200).json({
      hasError: false,
      message: "Head Of Account deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting Head Of Account:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default deleteHeadOfAccount;
