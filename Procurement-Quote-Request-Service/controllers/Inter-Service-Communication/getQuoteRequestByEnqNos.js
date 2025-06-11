import QuoteRequest from "../../models/QuoteRequest.js";

async function getQuoteRequestByEnqNos(req, res) {
  try {
    const { enquiryNumbers, fields } = req.query;
    if (!enquiryNumbers) {
      return res.status(400).json({
        hasError: true,
        message: "EnquiryNumbers are required",
      });
    }

    const enquiryNumbersArray = enquiryNumbers.split(",");

    let projection = {};
    if (fields?.trim()) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1;
      });
    }

    const quoteRequest = await QuoteRequest.find({
      enquiryNumber: { $in: enquiryNumbersArray },
    }).select(projection);

    return res.status(200).json({
      hasError: false,
      data: quoteRequest,
    });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getQuoteRequestByEnqNos;
