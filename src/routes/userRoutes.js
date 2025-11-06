const express = require("express");
const router = express.Router();
const {
  checkUserByCPF,
  deleteUser,
  registerUser,
  updateUser,
  updateProfileImage,
  hidePost,
  unhidePost,
} = require("../controllers/userController");

router.get("/checkUserByCPF", checkUserByCPF);
router.post("/registerUser", registerUser);
router.put("/updateUser/:cpf", updateUser);
router.patch("/updateProfileImage/:userId", updateProfileImage);
router.delete("/deleteUser/:userId", deleteUser);

// Ocultar/Exibir posts
router.post("/hidePost", hidePost);
router.post("/unhidePost", unhidePost);

module.exports = router;
