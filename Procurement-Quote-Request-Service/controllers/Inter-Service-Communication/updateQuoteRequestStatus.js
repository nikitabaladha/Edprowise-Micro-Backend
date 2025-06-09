import QuoteRequest from "../../models/QuoteRequest.js";

async function getQuoteRequestByEnquiryNumber(req, res) {
  try {
    const { enquiryNumber } = req.params;
    const { edprowiseStatus, buyerStatus } = req.body;

    if (!edprowiseStatus && !buyerStatus) {
      return res.status(400).json({
        hasError: true,
        message:
          "At least one of 'edprowiseStatus' or 'buyerStatus' must be provided.",
      });
    }

    const updateFields = {};
    if (edprowiseStatus) updateFields.edprowiseStatus = edprowiseStatus;
    if (buyerStatus) updateFields.buyerStatus = buyerStatus;

    const quoteRequest = await QuoteRequest.findOneAndUpdate(
      { enquiryNumber },
      updateFields,
      { new: true }
    );

    if (!quoteRequest) {
      return res.status(404).json({
        hasError: true,
        message: "Quote request not found",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Status updated successfully",
      data: quoteRequest,
    });
  } catch (error) {
    console.error("Error updating quote request status:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Failed to update status",
      error: error.message,
    });
  }
}

export default getQuoteRequestByEnquiryNumber;
