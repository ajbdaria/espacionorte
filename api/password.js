import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("espacionorte");

    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { username, currentPassword, newPassword } = req.body;

    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "username, currentPassword, and newPassword are all required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    // Verify current password against the users collection
    const user = await db.collection("users").findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    // Hash and save the new password
    const hashed = await bcrypt.hash(newPassword, 12);
    await db.collection("users").updateOne(
      { username },
      { $set: { password: hashed, updatedAt: new Date().toISOString() } }
    );

    await db.collection("logs").insertOne({
      type: "ok",
      msg: `Password changed for user: ${username}`,
      time: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, message: "Password updated successfully" });

  } catch (error) {
    console.error("Password change error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    await client.close();
  }
}