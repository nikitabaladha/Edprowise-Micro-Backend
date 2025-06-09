import OrderFromBuyer from "../../models/OrderFromBuyer.js";

async function getOrdersByEnquiryNumbers(req, res) {
  try {
    const { enquiryNumbers, fields } = req.query;

    if (!enquiryNumbers) {
      return res.status(400).json({
        hasError: true,
        message: "enquiryNumbers parameter is required",
      });
    }

    const enquiryNumbersArray = enquiryNumbers.split(",");

    // Create the select object based on requested fields
    let selectFields = {};
    if (fields) {
      const fieldArray = fields.split(",");
      fieldArray.forEach((field) => {
        selectFields[field.trim()] = 1;
      });
    }

    const orders = await OrderFromBuyer.find({
      enquiryNumber: { $in: enquiryNumbersArray },
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

export default getOrdersByEnquiryNumbers;
