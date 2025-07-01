import ledgerRoutes from "./Ledger.js";

export default (app) => {
  app.use("/api", ledgerRoutes);
};
