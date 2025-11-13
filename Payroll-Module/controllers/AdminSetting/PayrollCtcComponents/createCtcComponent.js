import PayrollCtcComponents from "../../../models/AdminSettings/PayrollCtcComponents.js";

const createCtcComponent = async (req, res) => {
  try {
    const {
      ctcComponentName,
      academicYear,
      schoolId,
      isActive = true,
    } = req.body;

    if (!ctcComponentName || !academicYear || !schoolId) {
      return res.status(400).json({
        hasError: true,
        message: "ctcComponentName, academicYear, and schoolId are required.",
      });
    }

    // Check for duplicate component name for the same school and year
    const existing = await PayrollCtcComponents.findOne({
      ctcComponentName,
      academicYear,
      schoolId,
    });

    if (existing) {
      return res.status(409).json({
        hasError: true,
        message:
          "CTC Component with this name already exists for the selected year and school.",
      });
    }

    const newComponent = new PayrollCtcComponents({
      ctcComponentName,
      academicYear,
      schoolId,
      isActive,
    });
    await newComponent.save();

    return res.status(201).json({
      hasError: false,
      message: "CTC Component created successfully.",
      component: newComponent,
    });
  } catch (error) {
    return res.status(500).json({
      hasError: true,
      message: "Error creating CTC Component.",
      error: error.message,
    });
  }
};

export default createCtcComponent;
