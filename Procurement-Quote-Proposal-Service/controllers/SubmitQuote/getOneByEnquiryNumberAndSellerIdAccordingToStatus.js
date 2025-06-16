import SubmitQuote from "../../models/SubmitQuote.js";
import QuoteProposal from "../../models/QuoteProposal.js";

import { getSellerById } from "../AxiosRequestService/userServiceRequest.js";
import { getQuoteRequestByEnquiryNumber } from "../AxiosRequestService/quoteRequestServiceRequest.js";

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

    const sellerResponse = await getSellerById(sellerId, "companyName");
    const companyName = sellerResponse?.data?.companyName || null;

    const quoteRequestResponse = await getQuoteRequestByEnquiryNumber(
      enquiryNumber,
      "buyerStatus,supplierStatus,edprowiseStatus"
    );
    const quoteRequestData = quoteRequestResponse?.data || null;

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
