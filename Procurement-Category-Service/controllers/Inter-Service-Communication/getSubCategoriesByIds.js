import SubCategory from "../../models/SubCategory.js";

async function getSubCategoriesByIds(req, res) {
  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({
        hasError: true,
        message: "ids parameter is required",
      });
    }

    const idArray = ids.split(",");
    const subcategories = await SubCategory.find({
      _id: { $in: idArray },
    }).select("subCategoryName");

    return res.status(201).json({ hasError: false, data: subcategories });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getSubCategoriesByIds;
