const authUtil = require("../../utils/auth.util");

async function authMiddleware(socket, next) {
  const token = socket.handshake.auth.token;
  console.log("[Socket.IO Middleware] Received token:", token);

  if (!token) {
    console.log("[Socket.IO Middleware] No token provided");
    return next(new Error("Access token is required"));
  }

  try {
    const decoded = await authUtil.verifyToken(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );
    console.log("[Socket.IO Middleware] Decoded token:", decoded);

    if (!decoded) {
      console.log("[Socket.IO Middleware] Token verification failed: null decoded");
      return next(new Error("Invalid token"));
    }

    socket.user = decoded.payload; // Lưu payload vào socket.user
    console.log("[Socket.IO Middleware] Token verified, user:", socket.user);
    next();
  } catch (error) {
    console.error("[Socket.IO Middleware] Token verification error:", error.message);
    next(new Error("Invalid token"));
  }
}

module.exports = { authMiddleware };