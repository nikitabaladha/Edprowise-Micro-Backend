import { getQuoteProposalBySellerIdEnqNoQuoteNo } from "../AxiosRequestService/quoteProposalServiceRequest.js";

async function getTDSAmount(req, res) {
  try {
    const { enquiryNumber, quoteNumber, sellerId } = req.query;

    if (!enquiryNumber || !quoteNumber || !sellerId) {
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumber, quoteNumber, and sellerId are required",
      });
    }

    const quoteProposalresponse = await getQuoteProposalBySellerIdEnqNoQuoteNo(
      enquiryNumber,
      quoteNumber,
      sellerId
    );

    if (quoteProposalresponse.hasError || !quoteProposalresponse.data) {
      return res.status(404).json({
        hasError: true,
        message:
          "No Quote Proposal found for the given enquiryNumber, quoteNumber, and sellerId.",
        error: result.error,
      });
    }

    const tDSAmount = quoteProposalresponse.data.tDSAmount || 0;

    return res.status(200).json({
      hasError: false,
      message: "TDS amount retrieved successfully.",
      data: tDSAmount,
    });
  } catch (error) {
    console.error("Error fetching TDS amount:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default getTDSAmount;
