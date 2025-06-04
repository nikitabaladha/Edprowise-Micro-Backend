import SubCategory from "../../../models/SubCategory.js";

// Get subcategory names by IDs (batch request)
async function getSubCategoriesByIds(req, res) {
  try {
    const { ids } = req.query;
    const idArray = ids.split(",");
    const subcategories = await SubCategory.find({
      _id: { $in: idArray },
    }).select("subCategoryName");

    return res.json({ hasError: false, data: subcategories });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getSubCategoriesByIds;
