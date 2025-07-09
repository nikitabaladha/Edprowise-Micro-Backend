import TDSTCSRateChart from "../../models/TDSTCSRateChart.js";

const copyTDSTCSRateCharts = async (
  schoolId,
  newAcademicYear,
  prevAcademicYear,
  session
) => {
  const previousTDSTCSRateCharts = await TDSTCSRateChart.find({
    schoolId,
    academicYear: prevAcademicYear,
  }).session(session);

  const newTDSTCSRateCharts = previousTDSTCSRateCharts.map((chart) => ({
    schoolId,
    TDSorTCS: chart.TDSorTCS,
    rate: chart.rate,
    natureOfTransaction: chart.natureOfTransaction,
    academicYear: newAcademicYear,
  }));

  if (newTDSTCSRateCharts.length > 0) {
    await TDSTCSRateChart.insertMany(newTDSTCSRateCharts, { session });
  }

  return newTDSTCSRateCharts.length;
};

export default copyTDSTCSRateCharts;
