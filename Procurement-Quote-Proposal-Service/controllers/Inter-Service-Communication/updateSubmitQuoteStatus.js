import SubmitQuote from "../../models/SubmitQuote.js";

async function updateSubmitQuoteStatus(req, res) {
  try {
    const { enquiryNumber, sellerId } = req.query;
    const updateData = req.body;

    if (!enquiryNumber || !sellerId) {
      return res.status(400).json({
        hasError: true,
        message: "Both 'enquiryNumber' and 'sellerId' are required in query.",
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        hasError: true,
        message: "Update data must be provided in request body.",
      });
    }

    const submitQuote = await SubmitQuote.findOneAndUpdate(
      { enquiryNumber, sellerId },
      updateData,
      { new: true }
    );

    if (!submitQuote) {
      return res.status(404).json({
        hasError: true,
        message: "Submit quote not found.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Submit quote updated successfully.",
      data: submitQuote,
    });
  } catch (error) {
    console.error("Error updating submit quote:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
      error: error.message,
    });
  }
}

export default updateSubmitQuoteStatus;
