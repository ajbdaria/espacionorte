import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("espacionorte");

    const RATE = 1999;

    const allBookings = await db.collection("bookings").find({}).toArray();

    // ── BUILD GUEST DIRECTORY (grouped by phone number) ──
    const guestMap = {};
    allBookings.forEach(b => {
      const key = b.ph;
      if (!key) return;
      if (!guestMap[key]) {
        guestMap[key] = {
          fn: b.fn,
          ln: b.ln,
          ph: b.ph,
          em: b.em || "",
          bookings: [],
        };
      }
      guestMap[key].bookings.push({
        _id:     b._id,
        ref:     b.ref,
        rm:      b.rm,
        ci:      b.ci,
        co:      b.co,
        px:      b.px,
        st:      b.st,
        nt:      b.nt || "",
        pay:     b.pay || "",
        created: b.created || null,
      });
    });

    // ── ENRICH & SORT ──
    const guests = Object.values(guestMap).map(g => {
      const nonCancelled = g.bookings.filter(b => b.st !== "cancelled");
      const completed    = g.bookings.filter(b => b.st === "checkedout");
      const upcoming     = g.bookings.filter(b => b.st !== "cancelled" && b.st !== "checkedout" && b.st !== "checkedin");
      const totalSpent   = nonCancelled.length * RATE;
      const lastStay     = completed.sort((a, b) => new Date(b.ci) - new Date(a.ci))[0] || null;

      // sort bookings newest first
      g.bookings.sort((a, b) => new Date(b.ci) - new Date(a.ci));

      return {
        ...g,
        stats: {
          totalBookings:    g.bookings.length,
          nonCancelled:     nonCancelled.length,
          completedStays:   completed.length,
          upcomingBookings: upcoming.length,
          totalSpent,
          lastStay:         lastStay ? lastStay.ci : null,
        },
      };
    });

    // sort by most bookings desc
    guests.sort((a, b) => b.stats.nonCancelled - a.stats.nonCancelled);

    // ── PENDING BADGE COUNT ──
    const pendingCount = allBookings.filter(b => b.st === "pending").length;

    res.status(200).json({ guests, pendingCount });

  } catch (error) {
    console.error("Guests error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    await client.close();
  }
}