import axios from "axios";
import Cart from "../../models/Cart.js";

async function deleteByEnquiryNumberAndSellerId(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message:
          "Access denied: You do not have permission to delete cart details.",
      });
    }

    const { enquiryNumber, sellerId } = req.query;

    if (!enquiryNumber) {
      return res.status(400).json({
        hasError: true,
        message: "Enquiry number is required.",
      });
    }

    if (!sellerId) {
      return res.status(400).json({
        hasError: true,
        message: "SellerId is required.",
      });
    }

    const deleteResult = await Cart.deleteMany({ enquiryNumber, sellerId });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        hasError: true,
        message: "No matching cart data found to delete.",
      });
    }

    try {
      await axios.put(
        `${process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL}/api/update-submitquote-by-status`,
        { venderStatusFromBuyer: "Pending" },
        {
          params: { enquiryNumber, sellerId },
        }
      );
    } catch (err) {
      console.error("Failed to update SubmitQuote:", err.message);
      return res.status(500).json({
        hasError: true,
        message:
          "Failed to update submit quote status in quote-proposal-service",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: `Removed from cart successfully.`,
    });
  } catch (error) {
    console.error("Error deleting Cart Data:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error.",
    });
  }
}

export default deleteByEnquiryNumberAndSellerId;
