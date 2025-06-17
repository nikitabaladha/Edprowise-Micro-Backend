import OrderFromBuyer from "../../models/OrderFromBuyer.js";

async function getOrderFromBuyerByOrdNo(req, res) {
  try {
    const { orderNumber, fields } = req.query;

    if (!orderNumber) {
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumber parameter is required",
      });
    }

    let selectFields = {};
    if (fields) {
      const fieldArray = fields.split(",");
      fieldArray.forEach((field) => {
        selectFields[field.trim()] = 1;
      });
    }

    const orders = await OrderFromBuyer.findOne({
      orderNumber,
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

export default getOrderFromBuyerByOrdNo;
