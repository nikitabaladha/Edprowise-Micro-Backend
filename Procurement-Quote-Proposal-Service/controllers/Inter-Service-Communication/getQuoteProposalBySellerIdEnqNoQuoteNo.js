import QuoteProposal from "../../models/QuoteProposal.js";

async function getQuoteProposalBySellerIdEnqNoQuoteNo(req, res) {
  try {
    const { enquiryNumber, quoteNumber, sellerId, fields } = req.query;

    if (!sellerId || !enquiryNumber || !quoteNumber) {
      return res.status(400).json({
        hasError: true,
        message: "sellerId, enquiryNumber, quoteNumber parameters are required",
      });
    }

    let projection = {};
    if (fields?.trim()) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1;
      });
    }

    const quote = await QuoteProposal.findOne({
      enquiryNumber,
      quoteNumber,
      sellerId,
    }).select(projection);

    if (!quote) {
      return res.status(404).json({
        hasError: true,
        message: "Quote Proposal not found.",
      });
    }

    return res.status(200).json({
      hasError: false,
      data: quote,
    });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getQuoteProposalBySellerIdEnqNoQuoteNo;
