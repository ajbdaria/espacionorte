import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const client = new MongoClient(process.env.MONGODB_URI);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { name, username, password } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
  }

  try {

    await client.connect();
    const db = client.db("espacionorte");

    const existing = await db.collection("users").findOne({ username });
    if (existing) {
      return res.status(400).json({ success: false, message: "Username already taken" });
    }

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

}