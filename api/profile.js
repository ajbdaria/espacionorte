import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db("espacionorte");

    // GET — fetch a user's profile by username
    if (req.method === "GET") {
      const { username } = req.query;
      if (!username) return res.status(400).json({ success: false, message: "username required" });
      const user = await db.collection("users").findOne({ username }, { projection: { password: 0 } });
      if (!user) return res.status(404).json({ success: false, message: "User not found" });
      return res.status(200).json(user);
    }

    // PUT — update profile fields (never touches password/role)
    if (req.method === "PUT") {
      const { username, ...fields } = req.body;
      if (!username) return res.status(400).json({ success: false, message: "username required" });
      // Whitelist updatable fields
      const allowed = ["phone","email","address","city","region","ecname","ecrel","ecphone","idtype","idnum","name"];
      const update = {};
      allowed.forEach(k => { if (fields[k] !== undefined) update[k] = fields[k]; });
      await db.collection("users").updateOne({ username }, { $set: update });
      await db.collection("logs").insertOne({
        type: "ok",
        msg: `Guest profile updated — ${username}`,
        time: new Date().toISOString(),
      });
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ message: "Method not allowed" });
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    await client.close();
  }
}