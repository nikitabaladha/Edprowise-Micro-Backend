import mongoose from "mongoose";
import FeesManagementYear from "../../../models/FeesManagementYear.js";
import DefaulterFeesArchive from "../../../models/DefaulterFeesArchive.js";
import ArrearFeesArchive from "../../../models/ArrearFeesArchive.js";
import computeDefaulterFees from "./computeDefaulterFees.js";

const validateDate = (dateStr, ctx = "") => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

const nextAcademicYear = (year) => {
  const [s, e] = year.split("-").map(Number);
  return `${s + 1}-${e + 1}`;
};

const archiveDefaulters = async (schoolId, academicYear, data, session) => {
  if (!data?.data?.length) return;

  const exists = await DefaulterFeesArchive.findOne({
    schoolId,
    academicYear,
  }).session(session);
  if (exists) return;

  await DefaulterFeesArchive.create(
    [{ schoolId, academicYear, defaulters: data.data, storedAt: new Date() }],
    { session }
  );
};

const carryForward = async (
  schoolId,
  academicYear,
  data,
  allYears,
  session
) => {
  const curr = allYears.find((y) => y.academicYear === academicYear);
  if (!curr) return;

  const end = validateDate(curr.endDate);
  if (!end || end >= new Date()) return;

  const next = nextAcademicYear(academicYear);
  const nextExists = allYears.find(
    (y) => y.academicYear === next && y.schoolId === schoolId
  );
  if (!nextExists) return;

  const toCarry = data.data
    .filter((d) => (d.totals?.totalBalance ?? 0) > 0)
    .map((d) => ({
      ...d,
      academicYear: next,
      installments: d.installments.map((i) => ({
        ...i,
        paymentDate: i.paymentDate === "-" ? "-" : i.paymentDate,
        reportStatus: [],
      })),
    }));

  if (!toCarry.length) return;

  const arch = await ArrearFeesArchive.findOne({
    schoolId,
    academicYear: next,
    previousacademicYear: academicYear,
  }).session(session);

  if (!arch) {
    await ArrearFeesArchive.create(
      [
        {
          schoolId,
          academicYear: next,
          previousacademicYear: academicYear,
          defaulters: toCarry,
          storedAt: new Date(),
        },
      ],
      { session }
    );
  } else {
    const merged = [
      ...arch.defaulters.filter(
        (ex) => !toCarry.some((n) => n.admissionNumber === ex.admissionNumber)
      ),
      ...toCarry,
    ];
    await ArrearFeesArchive.updateOne(
      { _id: arch._id },
      { $set: { defaulters: merged, storedAt: new Date() } },
      { session }
    );
  }
};

const run = async (
  schoolId,
  academicYear,
  classes,
  sections,
  installment,
  session
) => {
  const allYears = await FeesManagementYear.find({ schoolId })
    .lean()
    .session(session);
  if (!allYears.length) throw new Error("No academic years configured");

  const today = new Date();

  for (const y of allYears) {
    if (y.academicYear === academicYear) continue;
    const end = validateDate(y.endDate);
    if (!end || end >= today) continue;

    const defData = await computeDefaulterFees(
      schoolId,
      y.academicYear,
      session
    );
    await archiveDefaulters(schoolId, y.academicYear, defData, session);
  }

  const result = await computeDefaulterFees(
    schoolId,
    academicYear,
    session,
    classes,
    sections,
    installment
  );

  const curr = allYears.find((y) => y.academicYear === academicYear);
  if (curr) {
    const end = validateDate(curr.endDate);
    if (end && end < today) {
      await archiveDefaulters(schoolId, academicYear, result, session);
    }
  }

  await carryForward(schoolId, academicYear, result, allYears, session);

  return result;
};

export const DefaulterFees = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { schoolId, academicYear, classes, sections, installment } =
      req.query;

    if (!schoolId || !academicYear) {
      return res
        .status(400)
        .json({ message: "schoolId and academicYear are required" });
    }

    const result = await run(
      schoolId,
      academicYear,
      classes,
      sections,
      installment,
      session
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      data: result.data ?? [],
      feeTypes: result.feeTypes ?? [],
      filterOptions: result.filterOptions ?? {},
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("DefaulterFees API error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

export const runDefaulterFeesTask = async (
  schoolId,
  academicYear,
  classes,
  sections,
  installment
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await run(
      schoolId,
      academicYear,
      classes,
      sections,
      installment,
      session
    );
    await session.commitTransaction();
    session.endSession();
    return result;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export default DefaulterFees;
