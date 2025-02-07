exports.validateReport = (req, res, next) => {
  const { reportType, address, city, status } = req.body;
  if (!reportType || !address || !city || !status) {
    return res
      .status(400)
      .json({ message: "Todos os campos são obrigatórios." });
  }
  next();
};
