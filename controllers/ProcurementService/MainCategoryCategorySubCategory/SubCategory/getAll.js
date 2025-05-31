import SubCategory from "../../../../models/ProcurementService/SubCategory.js";
import MainCategory from "../../../../models/ProcurementService/MainCategory.js";

async function getAll(req, res) {
  try {
    const subCategories = await SubCategory.find()
      .populate({
        path: "categoryId",
        populate: {
          path: "mainCategoryId",
          model: MainCategory,
          select: "mainCategoryName _id",
        },
      })
      .sort({ createdAt: -1 })
      .select("subCategoryName _id categoryId");

    if (!subCategories.length) {
      return res.status(404).json({
        hasError: true,
        message: "No Sub Categories found.",
      });
    }

    const formattedSubCategories = subCategories.map((subCategory) => ({
      id: subCategory._id,
      subCategoryId: subCategory._id,
      subCategoryName: subCategory.subCategoryName,
      categoryId: subCategory.categoryId._id,
      categoryName: subCategory.categoryId.categoryName,
      mainCategoryId: subCategory.categoryId.mainCategoryId._id,
      mainCategoryName: subCategory.categoryId.mainCategoryId.mainCategoryName,
      edprowiseMargin: subCategory.categoryId.edprowiseMargin,
    }));

    return res.status(200).json({
      hasError: false,
      message: "Sub Categories retrieved successfully.",
      data: formattedSubCategories,
    });
  } catch (error) {
    console.error("Error fetching Sub Categories:", error);
    return res.status(500).json({
      hasError: true,
      message: "Failed to retrieve Sub Categories.",
      error: error.message,
    });
  }
}

export default getAll;
