import QuoteRequest from "../../models/QuoteRequest.js";

async function getQuoteRequestByEnquiryNumber(req, res) {
  try {
    const { enquiryNumber } = req.params;
    const { fields } = req.query;

    let selectFields = {};
    if (fields) {
      fields.split(",").forEach((field) => {
        selectFields[field.trim()] = 1;
      });
    }

    const quoteRequest = await QuoteRequest.findOne({ enquiryNumber }).select(
      selectFields
    );

    if (!quoteRequest) {
      return res.status(404).json({
        hasError: true,
        message: "Quote request not found.",
      });
    }

    return res.status(200).json({
      hasError: false,
      data: quoteRequest,
    });
  } catch (error) {
    console.error("Error fetching quote request:", error.message);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export default getQuoteRequestByEnquiryNumber;
