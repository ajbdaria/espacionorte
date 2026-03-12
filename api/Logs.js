import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("espacionorte");

    // ── GET — fetch latest 200 logs ──────────────────────────────────────
    if (req.method === "GET") {
      const logs = await db.collection("logs").find({}).sort({ time: -1 }).limit(200).toArray();
      return res.status(200).json(logs);
    }

    // ── POST — write a new log entry ─────────────────────────────────────
    if (req.method === "POST") {
      const { type, msg } = req.body;
      if (!type || !msg) {
        return res.status(400).json({ success: false, message: "type and msg are required" });
      }
      await db.collection("logs").insertOne({
        type,
        msg,
        time: new Date().toISOString(),
      });
      return res.status(200).json({ success: true });
    }

    // ── DELETE — clear entire log ────────────────────────────────────────
    if (req.method === "DELETE") {
      await db.collection("logs").deleteMany({});
      // Write one final entry so the log isn't completely empty
      await db.collection("logs").insertOne({
        type: "warn",
        msg: "Activity log cleared by admin",
        time: new Date().toISOString(),
      });
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ message: "Method not allowed" });

  } catch (error) {
    console.error("Logs error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    await client.close();
  }
}