import SubmitQuote from "../../models/SubmitQuote.js";
import QuoteRequest from "../../models/QuoteRequest.js";
import QuoteProposal from "../../models/QuoteProposal.js";

// import SellerProfile from "../../../models/SellerProfile.js";

import axios from "axios";

async function getAllByEnquiryNumberAccordingToStatus(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to view quote requests.",
      });
    }

    const { enquiryNumber } = req.params;

    if (!enquiryNumber) {
      return res.status(400).json({
        hasError: true,
        message: "Enquiry number is required.",
      });
    }

    const quotes = await SubmitQuote.find({
      enquiryNumber,
      venderStatus: "Quote Accepted",
    });

    if (!quotes.length) {
      return res.status(404).json({
        hasError: true,
        message: "No quotes found for the given enquiry number.",
      });
    }

    const quoteRequest = await QuoteRequest.findOne({ enquiryNumber });

    const buyerStatus = quoteRequest?.buyerStatus || null;
    const edprowiseStatus = quoteRequest?.edprowiseStatus || null;

    const sellerIds = quotes.map((quote) => quote.sellerId);

    let sellerProfiles = [];
    try {
      const response = await axios.get(
        `${process.env.USER_SERVICE_URL}/api/bulk-required-fields-from-seller-profile`,
        {
          params: {
            ids: sellerIds.join(","),
            fields: "companyName",
          },
        }
      );
      sellerProfiles = response.data?.data || [];
    } catch (err) {
      console.error(
        "Error fetching seller profiles from User Service:",
        err.message
      );
    }

    const sellerProfileMap = sellerProfiles.reduce((acc, profile) => {
      acc[profile.sellerId] = profile.companyName;
      return acc;
    }, {});

    const quoteProposals = await QuoteProposal.find({
      enquiryNumber,
      sellerId: { $in: sellerIds },
    });

    const statusMap = quoteProposals.reduce((acc, proposal) => {
      acc[proposal.sellerId] = {
        supplierStatus: proposal.supplierStatus,
        quoteNumber: proposal.quoteNumber,
      };
      return acc;
    }, {});

    const quotesWithCompanyName = quotes.map((quote) => ({
      ...quote.toObject(),
      companyName: sellerProfileMap[quote.sellerId] || null,
      buyerStatus: buyerStatus || null,
      supplierStatus: statusMap[quote.sellerId]?.supplierStatus || null,
      edprowiseStatus: edprowiseStatus || null,
      quoteNumber: statusMap[quote.sellerId]?.quoteNumber || null,
    }));

    return res.status(200).json({
      hasError: false,
      message: "Quotes retrieved successfully.",
      data: quotesWithCompanyName,
    });
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default getAllByEnquiryNumberAccordingToStatus;
