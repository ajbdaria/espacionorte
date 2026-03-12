import express from "express";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const router = express.Router();

router.post("/register", async (req, res) => {

  // ✅ Client created here, AFTER dotenv has loaded
  const client = new MongoClient(process.env.MONGODB_URI);

  const { name, username, password } = req.body;

  // Basic validation
  if (!name || !username || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
  }

  try {

    await client.connect();
    const db = client.db("espacionorte");

    // Check if username already taken
    const existing = await db.collection("users").findOne({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: "Username already taken" });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.collection("users").insertOne({
      name,
      username,
      password: hashedPassword,
      role: "guest",
      created: new Date()
    });

    res.status(200).json({ success: true });

  } catch (error) {

    console.error("Register error:", error);
    res.status(500).json({ success: false, message: "Server error" });

  } finally {

    await client.close();

  }

});

export default router;