// import School from "../../models/School.js";

// async function getSchoolsByIds(req, res) {
//   try {
//     const schoolIds = req.query.ids ? req.query.ids.split(",") : [];

//     if (!schoolIds.length) {
//       return res.status(400).json({
//         hasError: true,
//         message:
//           "School IDs are required as comma-separated values in 'ids' query parameter",
//       });
//     }

//     const schools = await School.find({ schoolId: { $in: schoolIds } });

//     return res.status(200).json({
//       hasError: false,
//       message: "Schools retrieved successfully",
//       data: schools,
//     });
//   } catch (error) {
//     console.error("Error in getSchoolsByIds:", error);
//     return res.status(500).json({
//       hasError: true,
//       message: "Failed to retrieve schools",
//       error: error.message,
//     });
//   }
// }

// export default getSchoolsByIds;

import School from "../../models/School.js";

async function getSchoolsByIds(req, res) {
  try {
    const { schoolIds, fields } = req.query;

    if (!schoolIds) {
      return res.status(400).json({
        hasError: true,
        message: "SchoolIds are required",
      });
    }

    const schoolIdArray = schoolIds.split(",").map((id) => id.trim());

    let projection = {};
    if (fields?.trim()) {
      fields.split(",").forEach((field) => {
        projection[field.trim()] = 1;
      });
    }

    const schools = await School.find({
      schoolId: { $in: schoolIdArray },
    }).select(projection);

    return res.status(200).json({
      hasError: false,
      data: schools,
    });
  } catch (error) {
    console.error("Error in get schools by schoolids:", error);
    return res.status(500).json({
      hasError: true,
      message: "Server error",
      error: error.message,
    });
  }
}

export default getSchoolsByIds;
