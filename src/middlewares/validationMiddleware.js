exports.validateReport = (req, res, next) => {
  const { reportType, address, city, status, location } = req.body;
  if (!reportType || !address || !city || !status) {
    return res
      .status(400)
      .json({ message: "Todos os campos são obrigatórios." });
  }

  if (location) {
    const { lat, lng } = location;
    const validLat = typeof lat === "number" && lat >= -90 && lat <= 90;
    const validLng = typeof lng === "number" && lng >= -180 && lng <= 180;

    if (!validLat || !validLng) {
      return res.status(400).json({
        message: "Coordenadas de localização inválidas.",
      });
    }
  }

  next();
};
