const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        console.log("🔐 Authorization header exists:", !!authHeader);

        const token = authHeader?.split(" ")[1];

        console.log("🔐 Token exists:", !!token);

        if (!token) {
            console.log("❌ NO TOKEN PROVIDED");

            return res.status(401).json({
                message: "No token provided"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        console.log("✅ JWT VERIFIED");
        console.log("👤 User ID:", decoded.userId);

        req.userId = decoded.userId;

        next();

    } catch (error) {

        console.log("❌ JWT VERIFICATION FAILED");
        console.log("Error name:", error.name);
        console.log("Error message:", error.message);

        return res.status(401).json({
            message: "Invalid token"
        });
    }
};

module.exports = authMiddleware;