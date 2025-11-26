const express = require("express");
const multer = require("multer");
const { uploadImage, uploadMultipleImages } = require("../controllers/uploadController");
const { isAdmin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Configurar multer para armazenar em memória
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por imagem
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos de imagem são permitidos."), false);
    }
  },
});

// Upload de imagem única
router.post("/image", isAdmin, upload.single("image"), uploadImage);

// Upload múltiplo de imagens (máximo 8)
router.post("/images", isAdmin, upload.array("images", 8), uploadMultipleImages);

module.exports = router;




