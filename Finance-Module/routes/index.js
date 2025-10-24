import FinanceModuleYearRoutes from "./FinanceModuleYear.js";
import ledgerRoutes from "./Ledger.js";
import vendorRoutes from "./Vendor.js";
import TDSTCSRateChartRoutes from "./TDSTCSRateChart.js";
import PaymentEntryRoutes from "./PaymentEntry.js";
import ReceiptRoutes from "./Receipt.js";
import AuthorisedSignatureRoutes from "./AuthorisedSignature.js";
import AllLedgerRoutes from "./AllLedgers.js";
import ContraRoutes from "./Contra.js";
import JournalRoutes from "./Journal.js";
import ReportsRoutes from "./AllReports.js";
import DepreciationMasterRoutes from "./DepreciationMaster.js";
import TrialBalanceRoutes from "./TrialBalance.js";
import OpeningClosingBalanceRoutes from "./OpeningClosingBalance.js";
import CustomizeEntryRoutes from "./CustomizeEntry.js";
import FinancialStatementRoutes from "./FinancialStatement.js";
import AuditorDocumentRoutes from "./AuditorDocument.js";

export default (app) => {
  app.use("/api", ledgerRoutes);
  app.use("/api", vendorRoutes);
  app.use("/api", TDSTCSRateChartRoutes);
  app.use("/api", PaymentEntryRoutes);
  app.use("/api", ReceiptRoutes);
  app.use("/api", ContraRoutes);
  app.use("/api", JournalRoutes);
  app.use("/api", CustomizeEntryRoutes);
  app.use("/api", AuthorisedSignatureRoutes);
  app.use("/api", FinanceModuleYearRoutes);
  app.use("/api", AllLedgerRoutes);
  app.use("/api", ReportsRoutes);

  app.use("/api", DepreciationMasterRoutes);
  app.use("/api", TrialBalanceRoutes);
  app.use("/api", OpeningClosingBalanceRoutes);
  app.use("/api", FinancialStatementRoutes);
  app.use("/api", AuditorDocumentRoutes);
};
