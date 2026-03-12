import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const client = new MongoClient(process.env.MONGODB_URI);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {

    await client.connect();
    const db = client.db("espacionorte");

    const user = await db.collection("users").findOne({ username });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    res.status(200).json({ success: true, role: user.role, username: user.username });

  } catch (error) {

    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });

  } finally {

    await client.close();

  }

}