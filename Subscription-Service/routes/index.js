import subscriptionRoutes from "./subscriptionRoutes.js";

export default (app) => {
  app.use("/api", subscriptionRoutes);
};
