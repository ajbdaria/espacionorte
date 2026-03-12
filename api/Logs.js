import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("espacionorte");

    if (req.method === "GET") {
      const logs = await db.collection("logs").find({}).sort({ time: -1 }).limit(100).toArray();
      return res.status(200).json(logs);
    }

    if (req.method === "POST") {
      const { type, msg } = req.body;
      await db.collection("logs").insertOne({ type, msg, time: new Date().toISOString() });
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