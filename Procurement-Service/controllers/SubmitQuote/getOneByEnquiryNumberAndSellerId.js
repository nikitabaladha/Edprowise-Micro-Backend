import SubmitQuote from "../../models/SubmitQuote.js";
import QuoteRequest from "../../models/QuoteRequest.js";
import QuoteProposal from "../../models/QuoteProposal.js";

import axios from "axios";

async function getOneByEnquiryNumberAndSellerId(req, res) {
  try {
    const { enquiryNumber, sellerId } = req.query;

    if (!enquiryNumber || !sellerId) {
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumber and sellerId are required.",
      });
    }

    const quote = await SubmitQuote.findOne({ enquiryNumber, sellerId });

    if (!quote) {
      return res.status(404).json({
        hasError: true,
        message: "No quote found for the given enquiry number and sellerId.",
      });
    }

    let companyName = null;
    try {
      const userServiceResponse = await axios.get(
        `${process.env.USER_SERVICE_URL}/api/required-field-from-seller-profile/${sellerId}`,
        {
          params: { fields: "companyName" },
        }
      );
      companyName = userServiceResponse?.data?.data?.companyName || null;
    } catch (error) {
      console.error(
        "Error fetching seller company name from User Service:",
        error.message
      );
    }

    const quoteRequest = await QuoteRequest.findOne({ enquiryNumber });

    const quoteProposal = await QuoteProposal.findOne({
      enquiryNumber,
      sellerId,
    });

    const responseData = {
      ...quote.toObject(),
      companyName,
      buyerStatus: quoteRequest?.buyerStatus || null,
      supplierStatus: quoteRequest?.supplierStatus || null,
      edprowiseStatus: quoteRequest?.edprowiseStatus || null,
      quoteNumber: quoteProposal?.quoteNumber || null,
    };

    return res.status(200).json({
      hasError: false,
      message: "Quote retrieved successfully.",
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching quote:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default getOneByEnquiryNumberAndSellerId;
