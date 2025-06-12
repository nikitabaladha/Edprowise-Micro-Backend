import QuoteProposal from "../../models/QuoteProposal.js";

async function getQuoteProposal(req, res) {
  try {
    const { sellerId, enquiryNumber, fields } = req.query;

    if (!sellerId || !enquiryNumber) {
      return res.status(400).json({
        hasError: true,
        message: "Both 'sellerId' and 'enquiryNumber' are required.",
      });
    }

    const projection = {};
    if (fields) {
      fields.split(",").forEach((field) => {
        if (field.trim()) {
          projection[field.trim()] = 1;
        }
      });
    }

    const quoteProposal = await QuoteProposal.findOne(
      {
        sellerId: sellerId,
        enquiryNumber: enquiryNumber,
      },
      projection
    );

    return res.status(200).json({
      hasError: false,
      message: "Quote proposals fetched successfully.",
      data: quoteProposal,
    });
  } catch (error) {
    console.error("Error in getQuoteProposal:", error);
    return res.status(500).json({
      hasError: true,
      message: "Failed to fetch quote proposals due to a server error.",
      error: error.message,
    });
  }
}

export default getQuoteProposal;
