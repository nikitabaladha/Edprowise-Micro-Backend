import Category from "../../../models/Category.js";

async function getCategoryById(req, res) {
  try {
    const { id } = req.params;
    const category = await Category.findById(id).select("categoryName");
    if (!category) {
      return res
        .status(404)
        .json({ hasError: true, message: "Category not found" });
    }
    return res.json({ hasError: false, data: category });
  } catch (error) {
    return res.status(500).json({ hasError: true, message: "Server error" });
  }
}

export default getCategoryById;
