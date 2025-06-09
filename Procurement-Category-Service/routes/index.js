import MainCategoryCategorySubCategoryRoutes from "./maincategory-category-subcategory.js";

import InterServiceCommunication from "./inter-service-communication.js";

export default (app) => {
  app.use("/api", MainCategoryCategorySubCategoryRoutes);

  app.use("/api", InterServiceCommunication);
};
