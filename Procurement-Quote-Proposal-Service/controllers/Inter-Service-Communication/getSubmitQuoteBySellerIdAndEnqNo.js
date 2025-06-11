import SubmitQuote from "../../models/SubmitQuote.js";

async function getSubmitQuoteBySellerIdAndEnqNo(req, res) {
  try {
    const { sellerId, enquiryNumber, fields } = req.query;
    if (!sellerId || !enquiryNumber) {
      return res.status(400).json({
        hasError: true,
        message: "sellerId and enquiryNumber parameters are required",
      });
    }

    let projection = {};
    if (fields?.trim()) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1;
      });
    }

    const quotes = await SubmitQuote.find({
      sellerId,
      enquiryNumber,
    }).select(projection);

    return res.status(200).json({
      hasError: false,
      data: quotes,
    });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getSubmitQuoteBySellerIdAndEnqNo;
