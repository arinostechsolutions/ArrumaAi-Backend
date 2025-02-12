const express = require("express");
const router = express.Router();
const {
  checkUserByCPF,
  deleteUser,
  registerUser,
  updateUser,
} = require("../controllers/userController");

router.get("/checkUserByCPF", checkUserByCPF);
router.post("/registerUser", registerUser);
router.put("/updateUser/:cpf", updateUser);
router.delete("/deleteUser/:cpf", deleteUser);

module.exports = router;
