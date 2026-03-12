import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("espacionorte");

    if (req.method === "GET") {
      const bookings = await db.collection("bookings").find({}).sort({ ci: -1 }).toArray();
      return res.status(200).json(bookings);
    }

    if (req.method === "POST") {
      const data = req.body;
      if (!data.fn || !data.ln || !data.rm || !data.ci || !data.co) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }
      data.ref = "EN-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      data.created = new Date().toISOString();
      data.st = data.st || "confirmed";
      await db.collection("bookings").insertOne(data);
      // Log it
      await db.collection("logs").insertOne({
        type: "ok",
        msg: `New booking created — ${data.fn} ${data.ln} (${data.ref})`,
        time: new Date().toISOString()
      });
      return res.status(200).json({ success: true, ref: data.ref });
    }

    if (req.method === "PUT") {
      const { ref, ...update } = req.body;
      if (!ref) return res.status(400).json({ success: false, message: "ref required" });
      await db.collection("bookings").updateOne({ ref }, { $set: update });
      await db.collection("logs").insertOne({
        type: "ok",
        msg: `Booking updated — ${ref} status: ${update.st || "modified"}`,
        time: new Date().toISOString()
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === "DELETE") {
      const { ref } = req.body;
      if (!ref) return res.status(400).json({ success: false, message: "ref required" });
      await db.collection("bookings").deleteOne({ ref });
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ message: "Method not allowed" });

  } catch (error) {
    console.error("Bookings error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    await client.close();
  }
}