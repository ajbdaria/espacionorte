import { MongoClient } from "mongodb";

// Collection: "settings"
// Documents use a `key` field as identifier:
//   { key: "pricing",   ... pricing fields }
//   { key: "policies",  ... policy fields  }
//   { key: "blocked",   dates: [...]       }

export default async function handler(req, res) {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db  = client.db("espacionorte");
    const col = db.collection("rules");

    // ── GET all settings ──────────────────────────────────────────────
    if (req.method === "GET") {
      const docs = await col.find({}).toArray();
      const out  = {};
      docs.forEach(d => {
        const { key, _id, ...rest } = d;
        out[key] = rest;
      });

      // Seed defaults if any key is missing
      if (!out.pricing) {
        out.pricing = { rate: 1999, hrs: 21, minpx: 1, maxpx: 4 };
      }
      if (!out.policies) {
        out.policies = {
          cancel: "flexible",
          checkinNote: "Call the owner upon arrival. Gate code will be shared on confirmation.",
          rules: "No smoking inside. No pets. No outside visitors. Quiet hours: 10PM–7AM.",
        };
      }
      if (!out.blocked) {
        out.blocked = { dates: [] };
      }

      // Also return pending count for sidebar badge
      const pendingCount = await db.collection("bookings").countDocuments({ st: "pending" });
      out.pendingCount = pendingCount;

      return res.status(200).json(out);
    }

    // ── PUT — upsert a single settings key ───────────────────────────
    if (req.method === "PUT") {
      const { key, ...data } = req.body;
      if (!key) return res.status(400).json({ success: false, message: "key required" });

      await col.updateOne(
        { key },
        { $set: { key, ...data, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );

      // Log it
      const logMsg = {
        pricing:  "Pricing settings updated",
        policies: "Booking policies updated",
        blocked:  "Blocked dates updated",
      }[key] || `Settings updated: ${key}`;

      await db.collection("logs").insertOne({
        type: "ok",
        msg:  logMsg,
        time: new Date().toISOString(),
      });

      return res.status(200).json({ success: true });
    }

    res.status(405).json({ message: "Method not allowed" });
  } catch (err) {
    console.error("Settings error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    await client.close();
  }
}