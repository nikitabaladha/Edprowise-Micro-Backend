import QuoteRequest from "../../models/QuoteRequest.js";

async function updateQuoteRequest(req, res) {
  try {
    const { enquiryNumber, schoolId } = req.query;
    const updateData = req.body;

    if (!enquiryNumber || !schoolId) {
      return res.status(400).json({
        hasError: true,
        message: "Both 'enquiryNumber' and 'schoolId' are required in query.",
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        hasError: true,
        message: "Update data must be provided in request body.",
      });
    }

    const updatedQuote = await QuoteRequest.findOneAndUpdate(
      { enquiryNumber, schoolId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedQuote) {
      return res.status(404).json({
        hasError: true,
        message: "Quote Request not found.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Quote request updated successfully.",
      data: updatedQuote,
    });
  } catch (error) {
    console.error("Error updating quote request:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
      error: error.message,
    });
  }
}

export default updateQuoteRequest;
