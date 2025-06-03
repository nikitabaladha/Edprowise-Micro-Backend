import mongoose from "mongoose";

const SubCategorySchema = new mongoose.Schema(
  {
    subCategoryName: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    mainCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainCategory",
      required: true,
    },
  },
  { timestamps: true }
);

SubCategorySchema.index(
  { categoryId: 1, subCategoryName: 1, mainCategoryId: 1 },
  { unique: true }
);

export default mongoose.model("SubCategory", SubCategorySchema);
