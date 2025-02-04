const express = require("express");
const {
  createCity,
  getAllCities,
  getCityById,
  deleteCity,
  updateReportTypes,
} = require("../controllers/cityController");

const router = express.Router();

router.post("/createCity", createCity);
router.get("/getAllCities", getAllCities);
router.get("/getCityById/:id", getCityById);
router.delete("/deleteCity/:id", deleteCity);

router.put("/updateReportTypes/:id", updateReportTypes);

module.exports = router;
