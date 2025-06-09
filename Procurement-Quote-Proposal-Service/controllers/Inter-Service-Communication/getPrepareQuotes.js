import PrepareQuote from "../../models/PrepareQuote.js";

async function getPrepareQuotes(req, res) {
  try {
    const { ids = "", enquiryNumber, fields } = req.query;

    if (!ids || !enquiryNumber) {
      return res.status(400).json({
        hasError: true,
        message: "Both 'ids' and 'enquiryNumber' are required.",
      });
    }

    const idArray = ids.split(",").map((id) => id.trim());

    const projection = {};
    if (fields) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1;
      });
    }

    const prepareQuotes = await PrepareQuote.find(
      {
        _id: { $in: idArray },
        enquiryNumber,
      },
      projection
    );

    return res.status(200).json({
      hasError: false,
      data: prepareQuotes,
    });
  } catch (error) {
    console.error("Error in getPrepareQuotesBulk:", error);
    return res.status(500).json({
      hasError: true,
      message: "Server error",
      error: error.message,
    });
  }
}

export default getPrepareQuotes;
