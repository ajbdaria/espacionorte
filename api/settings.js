import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("espacionorte");
    const col = db.collection("settings");

    // ── GET /api/settings
    // Returns the single settings document (upserted on first save)
    if (req.method === "GET") {
      const doc = await col.findOne({ _id: "main" });
      // Strip internal fields before returning
      if (doc) {
        const { _id, ...rest } = doc;
        return res.status(200).json(rest);
      }
      return res.status(200).json({});
    }

    // ── PUT /api/settings
    // Saves property info and/or display name.
    // Does NOT handle password — use POST /api/settings/password for that.
    if (req.method === "PUT") {
      const {
        propName, propType, addr, loc,
        phone, email, fb, airbnb, gcash, ig,
        adminName,
        // website tab
        wsTagline, wsSub, wsFooter,
        wsAllowBookings, wsShowPricing, wsMaintenance,
        // notification prefs (stored as booleans)
        notifNewBooking, notifCancelled, notifCheckinReminder,
        notifWeeklySummary, notifLowBooking,
      } = req.body;

      const update = {
        ...(propName            !== undefined && { propName }),
        ...(propType            !== undefined && { propType }),
        ...(addr                !== undefined && { addr }),
        ...(loc                 !== undefined && { loc }),
        ...(phone               !== undefined && { phone }),
        ...(email               !== undefined && { email }),
        ...(fb                  !== undefined && { fb }),
        ...(airbnb              !== undefined && { airbnb }),
        ...(gcash               !== undefined && { gcash }),
        ...(ig                  !== undefined && { ig }),
        ...(adminName           !== undefined && { adminName }),
        ...(wsTagline           !== undefined && { wsTagline }),
        ...(wsSub               !== undefined && { wsSub }),
        ...(wsFooter            !== undefined && { wsFooter }),
        ...(wsAllowBookings     !== undefined && { wsAllowBookings }),
        ...(wsShowPricing       !== undefined && { wsShowPricing }),
        ...(wsMaintenance       !== undefined && { wsMaintenance }),
        ...(notifNewBooking     !== undefined && { notifNewBooking }),
        ...(notifCancelled      !== undefined && { notifCancelled }),
        ...(notifCheckinReminder!== undefined && { notifCheckinReminder }),
        ...(notifWeeklySummary  !== undefined && { notifWeeklySummary }),
        ...(notifLowBooking     !== undefined && { notifLowBooking }),
        updatedAt: new Date().toISOString(),
      };

      await col.updateOne(
        { _id: "main" },
        { $set: update },
        { upsert: true }
      );

      // Log it
      await db.collection("logs").insertOne({
        type: "ok",
        msg: "Settings updated",
        time: new Date().toISOString(),
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (error) {
    console.error("Settings error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    await client.close();
  }
}