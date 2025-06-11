// import QuoteProposal from "../../models/QuoteProposal.js";

import {
  updateQuoteProposal,
  updateSubmitQuote,
  getQuoteProposal,
  fetchPrepareQuotes,
  fetchSubmitQuoteBySellerIdAndEnqNos,
  fetchSubmitQuoteBySellerIdsAndEnqNo,
} from "../AxiosRequestService/quoteProposalServiceRequest.js";

async function giveFeedBackAndRatingByBuyer(req, res) {
  try {
    const { enquiryNumber, sellerId, schoolId } = req.query;
    const { feedbackComment, rating } = req.body;

    if (!enquiryNumber || !sellerId || !schoolId) {
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumber, sellerId and schoolId are required.",
      });
    }

    // Validate rating
    if (rating === undefined || rating === null) {
      return res.status(400).json({
        hasError: true,
        message: "Rating is required.",
      });
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        hasError: true,
        message: "Rating must be a number between 1 and 5.",
      });
    }

    const updateData = {
      feedbackComment: feedbackComment || "",
      rating: numericRating,
    };

    const updatedQuoteResponse = await updateQuoteProposal(
      enquiryNumber,
      sellerId,
      updateData
    );

    if (updatedQuoteResponse.hasError || !updatedQuoteResponse.data) {
      return res.status(404).json({
        hasError: true,
        message:
          updatedQuoteResponse.message || "Failed to update quote proposal.",
        error: updatedQuoteResponse.error || null,
      });
    }

    const updatedQuote = updatedQuoteResponse.data;

    return res.status(200).json({
      hasError: false,
      message: "Feedback and rating submitted successfully.",
      data: updatedQuote,
    });
  } catch (error) {
    console.error("Error submitting feedback and rating:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default giveFeedBackAndRatingByBuyer;
