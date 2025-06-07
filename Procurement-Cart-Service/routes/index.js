import CartRoutes from "./cart-by-school.js";

export default (app) => {
  app.use("/api", CartRoutes);
};
