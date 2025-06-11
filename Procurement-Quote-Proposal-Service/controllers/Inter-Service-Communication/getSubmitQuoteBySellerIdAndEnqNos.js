import SubmitQuote from "../../models/SubmitQuote.js";

async function getSubmitQuoteBySellerIdAndEnqNos(req, res) {
  try {
    const { sellerId, enquiryNumbers, fields } = req.query;
    if (!sellerId || !enquiryNumbers) {
      return res.status(400).json({
        hasError: true,
        message: "sellerId and enquiryNumbers parameters are required",
      });
    }

    const enquiryNumbersArray = enquiryNumbers.split(",");

    let projection = {};
    if (fields?.trim()) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1;
      });
    }

    const quotes = await SubmitQuote.find({
      sellerId,
      enquiryNumber: { $in: enquiryNumbersArray },
    }).select(projection);

    return res.status(200).json({
      hasError: false,
      data: quotes,
    });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getSubmitQuoteBySellerIdAndEnqNos;
