// controllers/employee/getEmployeeDetailsByAcademicYear.js
import EmployeeRegistration from "../../../models/Employer/EmployeeRegistration.js";

const getEmployeeRegistrationDetails = async (req, res) => {
  try {
    const { id: schoolId, employeeId } = req.params;
    const { academicYear } = req.query;
    console.log("SchoolID", schoolId);
    console.log("EMployee ID", employeeId);
    console.log("Academic Year", academicYear);
    if (!schoolId || !employeeId || !academicYear) {
      return res.status(400).json({
        hasError: true,
        message: "schoolId, employeeId, and academicYear are required",
      });
    }

    const employee = await EmployeeRegistration.findOne({
      schoolId,
      employeeId,
    });

    if (!employee) {
      return res.status(404).json({
        hasError: true,
        message: "Employee not found",
      });
    }

    // Find data for the requested academic year
    const academicYearData = employee.academicYearDetails.find(
      (ay) => ay.academicYear === academicYear
    );

    // If no data for current academic year, find the latest academic year data
    // if (!academicYearData) {
    //     const latestAcademicYearData = [...employee.academicYearDetails]
    //         .sort((a, b) => b.academicYear.localeCompare(a.academicYear))[0];

    //     if (latestAcademicYearData) {
    //         // Clone the latest data for the current academic year
    //         const newAcademicYearData = {
    //             ...latestAcademicYearData,
    //             academicYear: academicYear,
    //             _id: undefined // Remove the _id to allow MongoDB to create a new one
    //         };

    //         return res.status(200).json({
    //             hasError: false,
    //             message: 'Using cloned data from previous academic year',
    //             data: {
    //                 ...employee.toObject(),
    //                 academicYearDetails: [...employee.academicYearDetails, newAcademicYearData],
    //                 currentAcademicYearData: newAcademicYearData
    //             },
    //             isCloned: true
    //         });
    //     }
    // }

    if (!academicYearData) {
      const sortedYears = [...employee.academicYearDetails].sort((a, b) =>
        b.academicYear.localeCompare(a.academicYear)
      );

      const latestAcademicYearData = sortedYears[0];

      if (latestAcademicYearData) {
        const plainPrevYear = latestAcademicYearData.toObject
          ? latestAcademicYearData.toObject()
          : latestAcademicYearData;

        const newAcademicYearData = {
          ...plainPrevYear,
          academicYear: academicYear,
          _id: undefined,
        };

        return res.status(200).json({
          hasError: false,
          message: "Using cloned data from previous academic year",
          data: {
            ...employee.toObject(),
            academicYearDetails: [
              ...employee.academicYearDetails.map((d) =>
                d.toObject ? d.toObject() : d
              ),
              newAcademicYearData,
            ],
            currentAcademicYearData: newAcademicYearData,
          },
          isCloned: true,
        });
      }
    }

    res.status(200).json({
      hasError: false,
      data: {
        ...employee.toObject(),
        currentAcademicYearData: academicYearData,
      },
      isCloned: false,
    });
  } catch (error) {
    console.error("Error fetching employee details:", error);
    res.status(500).json({
      hasError: true,
      message: error.message || "Failed to fetch employee details",
    });
  }
};

export default getEmployeeRegistrationDetails;
