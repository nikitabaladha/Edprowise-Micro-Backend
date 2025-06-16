import OrderDetailsFromSeller from "../../models/OrderDetailsFromSeller.js";

async function getOrderDetailsFromSellerBySchooIdSellerId(req, res) {
  try {
    const { sellerId, schoolId, fields } = req.query;

    if (!sellerId || !schoolId) {
      return res.status(400).json({
        hasError: true,
        message: "SchoolId and SellerId are required",
      });
    }

    let selectFields = {};
    if (fields) {
      const fieldArray = fields.split(",");
      fieldArray.forEach((field) => {
        selectFields[field.trim()] = 1;
      });
    }

    const orders = await OrderDetailsFromSeller.find({
      schoolId,
      sellerId,
    }).select(selectFields);

    return res.status(200).json({
      hasError: false,
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({
      hasError: true,
      message: "Server error",
      error: error.message,
    });
  }
}

export default getOrderDetailsFromSellerBySchooIdSellerId;
