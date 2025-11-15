import mongoose from "mongoose";
import AdmissionFormModel from "../../../models/AdmissionForm.js";
import { AdmissionPayment } from "../../../models/AdmissionForm.js";
import StudentRegistration from "../../../models/RegistrationForm.js";
import ClassAndSection from "../../../models/Class&Section.js";
import MasterDefineShift from "../../../models/MasterDefineShift.js";
import { AdmissionValidator } from "../../../validators/AdmissionValidator/Admissionvalidator.js";

const getFilePath = (file) => {
  if (!file) return "";
  return file.mimetype.startsWith("image/")
    ? `/Images/AdmissionForm/${file.filename}`
    : `/Documents/AdmissionForm/${file.filename}`;
};


const hasPaymentData = (body) => {
  const paymentFields = [
    "admissionFees",
    "concessionType",
    "concessionAmount",
    "finalAmount",
    "paymentMode",
    "chequeNumber",
    "bankName",
    "name",
  ];
  return paymentFields.some((field) => body[field] && body[field] !== "");
};

const admissionform = async (req, res) => {
  const schoolId = req.user?.schoolId;

  if (!schoolId) {
    return res.status(401).json({
      hasError: true,
      message: "Access denied: School ID missing.",
    });
  }

  const { error } = AdmissionValidator.validate(req.body);
  if (error) {
    return res.status(400).json({
      hasError: true,
      message: error.details[0].message,
    });
  }

  const files = req.files || {};
  if (!files || typeof files !== "object") {
    return res.status(400).json({
      hasError: true,
      message: "Invalid or missing file uploads.",
    });
  }

  try {
    const {
      registrationNumber,
      academicYear,
      masterDefineClass,
      section,
      masterDefineShift,
      admissionFees,
      concessionType,
      concessionAmount,
      finalAmount,
      paymentMode,
      chequeNumber,
      bankName,
      name,
      ...studentFields
    } = req.body;

    const normalizedRegistrationNumber =
      registrationNumber &&
        registrationNumber.trim() !== "" &&
        registrationNumber.toLowerCase() !== "null"
        ? registrationNumber.trim()
        : null;

    if (normalizedRegistrationNumber) {
      const existingAdmission = await AdmissionFormModel.findOne({
        schoolId,
        registrationNumber: normalizedRegistrationNumber,
      });
      if (existingAdmission) {
        return res.status(409).json({
          hasError: true,
          message: `Student with registration number ${normalizedRegistrationNumber} already exists in this school.`,
          admission: existingAdmission,
        });
      }
    }

    const classExists = await ClassAndSection.findOne({
      _id: masterDefineClass,
      schoolId,
      academicYear,
    });
    if (!classExists) {
      return res.status(400).json({
        hasError: true,
        message: "Invalid class ID provided.",
      });
    }

    const sectionExists = classExists.sections.find(
      (sec) =>
        sec._id.toString() === section &&
        sec.shiftId.toString() === masterDefineShift
    );
    if (!sectionExists) {
      return res.status(400).json({
        hasError: true,
        message: "Invalid section or shift ID provided.",
      });
    }

    const shiftExists = await MasterDefineShift.findOne({
      _id: masterDefineShift,
      schoolId,
      academicYear,
    });
    if (!shiftExists) {
      return res.status(400).json({
        hasError: true,
        message: "Invalid shift ID provided.",
      });
    }

    const registeredStudent = normalizedRegistrationNumber
      ? await StudentRegistration.findOne({
        schoolId,
        registrationNumber: normalizedRegistrationNumber,
      })
      : null;

    const studentData = {
      ...studentFields,
      schoolId,
      registrationNumber: normalizedRegistrationNumber,
      academicYear,
      academicHistory: [
        {
          academicYear,
          masterDefineClass,
          section,
          masterDefineShift,
        },
      ],
      studentPhoto: files?.studentPhoto?.[0]
        ? getFilePath(files.studentPhoto[0])
        : registeredStudent?.studentPhoto || "",
      aadharPassportFile: files?.aadharPassportFile?.[0]
        ? getFilePath(files.aadharPassportFile[0])
        : registeredStudent?.aadharPassportFile || "",
      castCertificate: files?.castCertificate?.[0]
        ? getFilePath(files.castCertificate[0])
        : registeredStudent?.castCertificate || "",
      tcCertificate: files?.tcCertificate?.[0]
        ? getFilePath(files.tcCertificate[0])
        : registeredStudent?.tcCertificate || "",
      previousSchoolResult: files?.previousSchoolResult?.[0]
        ? getFilePath(files.previousSchoolResult[0])
        : registeredStudent?.previousSchoolResult || "",
      idCardFile: files?.idCardFile?.[0]
        ? getFilePath(files.idCardFile[0])
        : registeredStudent?.idCardFile || "",
      proofOfResidence: files?.proofOfResidence?.[0]
        ? getFilePath(files.proofOfResidence[0])
        : registeredStudent?.proofOfResidence || "",
    };

    const newAdmission = new AdmissionFormModel(studentData);
    await newAdmission.save();

    let newPayment = null;
    if (hasPaymentData(req.body)) {
      const paymentData = {
        studentId: newAdmission._id,
        schoolId,
        academicYear: newAdmission.academicYear,
        admissionFees: admissionFees || 0,
        concessionType: concessionType || null,
        concessionAmount: concessionAmount || 0,
        finalAmount: finalAmount || 0,
        paymentMode: paymentMode || "null",
        chequeNumber: chequeNumber || "",
        bankName: bankName || "",
        name: name || "",
      };

      newPayment = new AdmissionPayment(paymentData);
      await newPayment.save();
    }

    res.status(201).json({
      hasError: false,
      message: "Admission form submitted successfully.",
      admission: newAdmission,
      payment: newPayment || null,
    });
  } catch (err) {
    console.error("Admission error:", err);
    const message =
      err.code === 11000
        ? "Admission number or other unique field already exists."
        : err.message || "An error occurred during admission form submission.";
    res.status(500).json({
      hasError: true,
      message,
    });
  }
};

export default admissionform;
