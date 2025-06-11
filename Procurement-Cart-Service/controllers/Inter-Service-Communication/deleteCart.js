import Cart from "../../models/Cart.js";

async function deleteCarts(req, res) {
  try {
    const { enquiryNumber, schoolId, cartIds } = req.body;

    if (
      !enquiryNumber ||
      !schoolId ||
      !Array.isArray(cartIds) ||
      cartIds.length === 0
    ) {
      return res.status(400).json({
        hasError: true,
        message: "Missing or invalid enquiryNumber, schoolId, or cartIds.",
      });
    }

    const result = await Cart.deleteMany({
      _id: { $in: cartIds },
      enquiryNumber,
      schoolId,
    });

    return res.status(200).json({
      hasError: false,
      message: `${result.deletedCount} cart(s) deleted successfully.`,
    });
  } catch (error) {
    console.error("Error deleting carts:", error);
    return res.status(500).json({
      hasError: true,
      message: "Failed to delete carts.",
      error: error.message,
    });
  }
}

export default deleteCarts;
