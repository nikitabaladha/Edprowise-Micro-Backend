import FinanceModuleYearRoutes from "./FinanceModuleYear.js";

import ledgerRoutes from "./Ledger.js";
import vendorRoutes from "./Vendor.js";
import TDSTCSRateChartRoutes from "./TDSTCSRateChart.js";
import PaymentEntryRoutes from "./PaymentEntry.js";
import ReceiptRoutes from "./Receipt.js";
import AuthorisedSignatureRoutes from "./AuthorisedSignature.js";
import AllLedgerRoutes from "./AllLedgers.js";

export default (app) => {
  app.use("/api", ledgerRoutes);
  app.use("/api", vendorRoutes);
  app.use("/api", TDSTCSRateChartRoutes);
  app.use("/api", PaymentEntryRoutes);
  app.use("/api", ReceiptRoutes);
  app.use("/api", AuthorisedSignatureRoutes);
  app.use("/api", FinanceModuleYearRoutes);
  app.use("/api", AllLedgerRoutes);
};
