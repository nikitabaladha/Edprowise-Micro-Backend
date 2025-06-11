import PrepareQuote from "../../models/PrepareQuote.js";

async function getPrepareQuoteBySellerIdsAndEnqNos(req, res) {
  try {
    const { sellerIds, enquiryNumbers, fields } = req.query;
    if (!sellerIds || !enquiryNumbers) {
      return res.status(400).json({
        hasError: true,
        message: "sellerId and enquiryNumbers parameters are required",
      });
    }

    const sellerIdArray = sellerIds.split(",").map((id) => id.trim());

    const enquiryNumbersArray = enquiryNumbers.split(",").map((e) => e.trim());

    let projection = {};
    if (fields?.trim()) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1;
      });
    }

    const quotes = await PrepareQuote.find({
      sellerId: { $in: sellerIdArray },
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

export default getPrepareQuoteBySellerIdsAndEnqNos;
