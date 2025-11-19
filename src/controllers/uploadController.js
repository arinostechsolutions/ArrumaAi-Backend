const cloudinary = require("cloudinary").v2;
const { Readable } = require("stream");

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload de imagem única
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhuma imagem enviada." });
    }

    // Converter buffer para stream
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "positive-posts",
        resource_type: "image",
        transformation: [
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) {
          console.error("❌ Erro ao fazer upload para Cloudinary:", error);
          return res.status(500).json({
            message: "Erro ao fazer upload da imagem.",
            error: error.message,
          });
        }

        console.log("✅ Imagem enviada com sucesso:", result.secure_url);
        return res.status(200).json({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      }
    );

    // Enviar buffer para Cloudinary
    const bufferStream = Readable.from(req.file.buffer);
    bufferStream.pipe(stream);
  } catch (error) {
    console.error("❌ Erro ao processar upload:", error);
    return res.status(500).json({
      message: "Erro interno ao processar upload.",
      error: error.message,
    });
  }
};

// Upload múltiplo de imagens
exports.uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Nenhuma imagem enviada." });
    }

    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "positive-posts",
            resource_type: "image",
            transformation: [
              { quality: "auto" },
              { fetch_format: "auto" },
            ],
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve({
                url: result.secure_url,
                publicId: result.public_id,
                width: result.width,
                height: result.height,
              });
            }
          }
        );

        const bufferStream = Readable.from(file.buffer);
        bufferStream.pipe(stream);
      });
    });

    const results = await Promise.all(uploadPromises);
    console.log(`✅ ${results.length} imagem(ns) enviada(s) com sucesso`);

    return res.status(200).json({
      images: results,
      total: results.length,
    });
  } catch (error) {
    console.error("❌ Erro ao processar upload múltiplo:", error);
    return res.status(500).json({
      message: "Erro interno ao processar upload.",
      error: error.message,
    });
  }
};

