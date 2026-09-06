const express = require("express");
const User = require("../models/User");
const jwt = require("jsonwebtoken")
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
// this is where frontend talks to mongoDb directly
router.post("/signup", async (req, res) => {
    console.log("🔥 SIGNUP ROUTE HIT");
    console.log(req.body);
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, Email and passwords are required" })
            alert("The following fields are required!");
        }

        const user = new User({ name, email, password });
        await user.save();

        res.status(200).json({
            message: "User registered successfully"
        });
    }
    catch (error) {
        console.log("something went wrong", error);
        res.status(500).json({
            message: "Something went wrong"
        });
    }
})

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and passwords are required" })
            alert("Email and passwords are required")
        }
        let user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({ message: "User not found!" })
            alert("User not found!");
        }
        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid password" })
            alert("Invalid Password!");
        }
        console.log("User verified:", user.email);
        console.log("JWT secret exists:", !!process.env.JWT_SECRET);
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        console.log("JWT CREATED:", token);
        res.status(200).json({
            message: "Login successful",
            token: token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            }
        });


    } catch (error) {
        console.log("Login problem", error)
    }
})

router.get("/verify", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.status(200).json({
            valid: true,
            user
        });

    } catch (error) {
        console.log("Verification error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
});



module.exports = router; 