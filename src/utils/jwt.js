const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "resolveai-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

exports.signAdminToken = (payload = {}) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};





