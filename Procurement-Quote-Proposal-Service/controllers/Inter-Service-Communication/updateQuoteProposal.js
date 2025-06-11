import QuoteProposal from "../../models/QuoteProposal.js";

async function updateQuoteProposal(req, res) {
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

    const quoteProposal = await QuoteProposal.findOneAndUpdate(
      { enquiryNumber, sellerId },
      updateData,
      { new: true }
    );

    if (!quoteProposal) {
      return res.status(404).json({
        hasError: true,
        message: "Quote Proposal not found.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Quote Proposal updated successfully.",
      data: quoteProposal,
    });
  } catch (error) {
    console.error("Error updating quote proposal:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
      error: error.message,
    });
  }
}

export default updateQuoteProposal;
