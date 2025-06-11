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

    const quotes = await QuoteProposal.find({
      enquiryNumber,
      quoteNumber,
      sellerId,
    }).select(projection);

    return res.status(200).json({
      hasError: false,
      data: quotes,
    });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getQuoteProposalBySellerIdEnqNoQuoteNo;
