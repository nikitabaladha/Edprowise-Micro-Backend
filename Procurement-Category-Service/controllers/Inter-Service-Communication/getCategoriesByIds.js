import Category from "../../models/Category.js";

async function getCategoriesByIds(req, res) {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({
        hasError: true,
        message: "ids parameter is required",
      });
    }

    const idArray = ids.split(",");
    const categories = await Category.find({
      _id: { $in: idArray },
    }).select("categoryName edprowiseMargin");

    if (!categories) {
      return res
        .status(404)
        .json({ hasError: true, message: "Categories not found" });
    }

    return res.status(201).json({ hasError: false, data: categories });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getCategoriesByIds;
