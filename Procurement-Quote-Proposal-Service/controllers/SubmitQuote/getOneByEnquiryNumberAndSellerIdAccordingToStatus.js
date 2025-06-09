import SubmitQuote from "../../models/SubmitQuote.js";
import QuoteProposal from "../../models/QuoteProposal.js";
import axios from "axios";

// import SellerProfile from "../../../models/SellerProfile.js";

// import QuoteRequest from "../../models/QuoteRequest.js";

async function getOneByEnquiryNumberAndSellerIdAccordingToStatus(req, res) {
  try {
    const { enquiryNumber, sellerId } = req.query;

    if (!enquiryNumber || !sellerId) {
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumber and sellerId are required.",
      });
    }

    const quote = await SubmitQuote.findOne({
      enquiryNumber,
      sellerId,
      venderStatus: "Quote Accepted",
    });

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

    let quoteRequestData = null;
    try {
      const encodedEnquiryNumber = encodeURIComponent(enquiryNumber);
      const response = await axios.get(
        `${process.env.PROCUREMENT_QUOTE_REQUEST_SERVICE_URL}/api/quote-requests/${encodedEnquiryNumber}`,
        {
          params: { fields: "buyerStatus,supplierStatus,edprowiseStatus" },
        }
      );
      quoteRequestData = response.data?.data || null;
    } catch (error) {
      console.error(
        "Error fetching quote request from quote-request service:",
        error.message
      );
    }

    const quoteProposal = await QuoteProposal.findOne({
      enquiryNumber,
      sellerId,
    });

    const responseData = {
      ...quote.toObject(),
      companyName,
      buyerStatus: quoteRequestData?.buyerStatus || null,
      supplierStatus: quoteRequestData?.supplierStatus || null,
      edprowiseStatus: quoteRequestData?.edprowiseStatus || null,
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

export default getOneByEnquiryNumberAndSellerIdAccordingToStatus;
