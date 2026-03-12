import { MongoClient } from "mongodb";

const DEFAULT_ROOMS = [
  {
    id: "1",
    name: "Sterling",
    emoji: "🌅",
    bed: "King Bed",
    sqm: "32",
    maxpx: 4,
    rate: 1999,
    desc: "King bed suite with warm interiors, perfect for families and couples.",
    amen: "Air-conditioning, Smart TV, Hot Shower, Mini Bar, Free Wifi, Private Bath",
  },
  {
    id: "2",
    name: "Habi",
    emoji: "🌊",
    bed: "Queen Bed",
    sqm: "30",
    maxpx: 4,
    rate: 1999,
    desc: "Queen bed suite with serene vibes, natural light, and tropical touches.",
    amen: "Air-conditioning, Smart TV, Hot Shower, Mini Bar, Free Wifi, Private Bath",
  },
];

export default async function handler(req, res) {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("espacionorte");
    const col = db.collection("rooms");

    // ── GET all rooms (seed defaults if empty) ──────────────────────────
    if (req.method === "GET") {
      let rooms = await col.find({}).sort({ id: 1 }).toArray();

      if (!rooms.length) {
        await col.insertMany(DEFAULT_ROOMS);
        rooms = DEFAULT_ROOMS;
      }

      return res.status(200).json(rooms);
    }

    // ── POST — add new room ─────────────────────────────────────────────
    if (req.method === "POST") {
      const data = req.body;
      if (!data.name) {
        return res.status(400).json({ success: false, message: "Suite name is required" });
      }

      // Auto-assign next numeric ID
      const existing = await col.find({}).toArray();
      const nextId = existing.length
        ? String(Math.max(...existing.map((r) => parseInt(r.id) || 0)) + 1)
        : "1";

      const room = {
        id: nextId,
        name: data.name,
        emoji: data.emoji || "🏠",
        bed: data.bed || "King Bed",
        sqm: data.sqm || "",
        maxpx: parseInt(data.maxpx) || 4,
        rate: parseInt(data.rate) || 0,
        desc: data.desc || "",
        amen: data.amen || "",
        created: new Date().toISOString(),
      };

      await col.insertOne(room);
      await db.collection("logs").insertOne({
        type: "ok",
        msg: `New suite added — Suite ${nextId} · ${room.name}`,
        time: new Date().toISOString(),
      });

      return res.status(200).json({ success: true, id: nextId, room });
    }

    // ── PUT — update existing room ──────────────────────────────────────
    if (req.method === "PUT") {
      const { id, ...update } = req.body;
      if (!id) return res.status(400).json({ success: false, message: "id required" });

      delete update._id; // never overwrite Mongo _id
      await col.updateOne({ id }, { $set: update });
      await db.collection("logs").insertOne({
        type: "ok",
        msg: `Suite ${id} · ${update.name || id} updated`,
        time: new Date().toISOString(),
      });

      return res.status(200).json({ success: true });
    }

    // ── DELETE — remove a room ──────────────────────────────────────────
    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ success: false, message: "id required" });

      // Safety: block delete if active bookings exist
      const activeBooking = await db.collection("bookings").findOne({
        rm: id,
        st: { $in: ["confirmed", "checkedin", "pending"] },
      });

      if (activeBooking) {
        return res.status(409).json({
          success: false,
          message: "Cannot remove — suite has active bookings",
        });
      }

      const room = await col.findOne({ id });
      await col.deleteOne({ id });
      await db.collection("logs").insertOne({
        type: "warn",
        msg: `Suite ${id} · ${room?.name || id} removed`,
        time: new Date().toISOString(),
      });

      return res.status(200).json({ success: true });
    }

    res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error("Rooms API error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    await client.close();
  }
}