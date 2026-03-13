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
      if (doc) {
        const { _id, ...rest } = doc;
        return res.status(200).json(rest);
      }
      return res.status(200).json({});
    }

    // ── PUT /api/settings
    // Saves property info, display name, website settings,
    // notification prefs, AND pricing & rules fields.
    if (req.method === "PUT") {
      const {
        // ── Property / contact
        propName, propType, addr, loc,
        phone, email, fb, airbnb, gcash, ig,
        adminName,

        // ── Website tab
        wsTagline, wsSub, wsFooter,
        wsAllowBookings, wsShowPricing, wsMaintenance,

        // ── Notification prefs
        notifNewBooking, notifCancelled, notifCheckinReminder,
        notifWeeklySummary, notifLowBooking,

        // ── Pricing & Rules tab
        prRate,           // number — standard rate ₱ per booking
        prHrs,            // number — stay duration in hours
        prMinPx,          // number — minimum guests
        prMaxPx,          // number — maximum guests per room
        prCancelPolicy,   // string — "flexible" | "moderate" | "strict"
        prCheckinNote,    // string — check-in instructions
        prHouseRules,     // string — house rules text

        // ── Blocked dates (full array replacement)
        // Pass the entire updated array; backend overwrites in place.
        blockedDates,     // Array<{ date: string, rm: string, reason: string }>
      } = req.body;

      const update = {
        // Property / contact
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

        // Website tab
        ...(wsTagline           !== undefined && { wsTagline }),
        ...(wsSub               !== undefined && { wsSub }),
        ...(wsFooter            !== undefined && { wsFooter }),
        ...(wsAllowBookings     !== undefined && { wsAllowBookings }),
        ...(wsShowPricing       !== undefined && { wsShowPricing }),
        ...(wsMaintenance       !== undefined && { wsMaintenance }),

        // Notification prefs
        ...(notifNewBooking     !== undefined && { notifNewBooking }),
        ...(notifCancelled      !== undefined && { notifCancelled }),
        ...(notifCheckinReminder!== undefined && { notifCheckinReminder }),
        ...(notifWeeklySummary  !== undefined && { notifWeeklySummary }),
        ...(notifLowBooking     !== undefined && { notifLowBooking }),

        // Pricing & Rules
        ...(prRate              !== undefined && { prRate: Number(prRate) }),
        ...(prHrs               !== undefined && { prHrs: Number(prHrs) }),
        ...(prMinPx             !== undefined && { prMinPx: Number(prMinPx) }),
        ...(prMaxPx             !== undefined && { prMaxPx: Number(prMaxPx) }),
        ...(prCancelPolicy      !== undefined && { prCancelPolicy }),
        ...(prCheckinNote       !== undefined && { prCheckinNote }),
        ...(prHouseRules        !== undefined && { prHouseRules }),

        // Blocked dates (full array replacement)
        ...(blockedDates        !== undefined && { blockedDates }),

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

    // ── PATCH /api/settings/blocked-dates
    // Convenience endpoint: add or remove a single blocked date
    // without sending the full array.
    //
    // Body to ADD:    { action: "add",    entry: { date, rm, reason } }
    // Body to REMOVE: { action: "remove", date, rm }
    if (req.method === "PATCH") {
      const { action, entry, date, rm } = req.body;

      const doc = await col.findOne({ _id: "main" });
      let blocked = doc?.blockedDates ?? [];

      if (action === "add") {
        if (!entry?.date) return res.status(400).json({ message: "entry.date required" });
        blocked.push({
          date: entry.date,
          rm:   entry.rm     ?? "both",
          reason: entry.reason ?? "",
        });
      } else if (action === "remove") {
        if (!date) return res.status(400).json({ message: "date required" });
        blocked = blocked.filter(
          (b) => !(b.date === date && (rm === undefined || b.rm === rm))
        );
      } else {
        return res.status(400).json({ message: "action must be 'add' or 'remove'" });
      }

      await col.updateOne(
        { _id: "main" },
        { $set: { blockedDates: blocked, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );

      await db.collection("logs").insertOne({
        type: "ok",
        msg: `Blocked date ${action === "add" ? "added" : "removed"}: ${entry?.date ?? date}`,
        time: new Date().toISOString(),
      });

      return res.status(200).json({ success: true, blockedDates: blocked });
    }

    return res.status(405).json({ message: "Method not allowed" });

  } catch (error) {
    console.error("Settings error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    await client.close();
  }
}