import TDSTCSRateChart from "../../models/TDSTCSRateChart.js";

const copyTDSTCSRateCharts = async (
  schoolId,
  newFinancialYear,
  prevFinancialYear,
  session
) => {
  const previousTDSTCSRateCharts = await TDSTCSRateChart.find({
    schoolId,
    financialYear: prevFinancialYear,
  }).session(session);

  const newTDSTCSRateCharts = previousTDSTCSRateCharts.map((chart) => ({
    schoolId,
    TDSorTCS: chart.TDSorTCS,
    rate: chart.rate,
    natureOfTransaction: chart.natureOfTransaction,
    financialYear: newFinancialYear,
  }));

  if (newTDSTCSRateCharts.length > 0) {
    await TDSTCSRateChart.insertMany(newTDSTCSRateCharts, { session });
  }

  return newTDSTCSRateCharts.length;
};

export default copyTDSTCSRateCharts;
