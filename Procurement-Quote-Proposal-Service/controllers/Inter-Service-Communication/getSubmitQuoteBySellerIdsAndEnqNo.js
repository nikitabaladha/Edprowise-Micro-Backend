import SubmitQuote from "../../models/SubmitQuote.js";

async function getSubmitQuoteBySellerIdsAndEnqNo(req, res) {
  try {
    const { sellerIds, enquiryNumber, fields } = req.query;
    if (!sellerIds || !enquiryNumber) {
      return res.status(400).json({
        hasError: true,
        message: "sellerIds and enquiryNumbers parameters are required",
      });
    }

    const sellerIdArray = sellerIds.split(",").map((id) => id.trim());

    let projection = {};
    if (fields?.trim()) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1;
      });
    }

    const quotes = await SubmitQuote.find({
      sellerId: { $in: sellerIdArray },
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

export default getSubmitQuoteBySellerIdsAndEnqNo;
