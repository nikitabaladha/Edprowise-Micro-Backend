import Vendor from "../../../models/Vendor.js";

async function getOneByVendorCode(req, res) {
  try {
    const schoolId = req.user?.schoolId;

    const { vendorCode, financialYear } = req.params;

    if (!schoolId) {
      return res.status(401).json({
        hasError: true,
        message: "Access denied: School ID not found in user context.",
      });
    }

    if (!vendorCode) {
      return res.status(400).json({
        hasError: true,
        message: "Vendor code is required in the request parameters.",
      });
    }

    const vendor = await Vendor.findOne({
      schoolId,
      vendorCode,
      financialYear,
    });

    if (!vendor) {
      return res.status(404).json({
        hasError: true,
        message: "Vendor not found with the given code and school ID.",
      });
    }

    return res.status(200).json({
      hasError: false,
      message: "Vendor fetched successfully.",
      data: vendor,
    });
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return res.status(500).json({
      hasError: true,
      message: "Internal server error. Please try again later.",
    });
  }
}

export default getOneByVendorCode;
