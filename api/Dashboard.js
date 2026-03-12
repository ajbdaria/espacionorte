import { MongoClient } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("espacionorte");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const allBookings = await db.collection("bookings").find({}).toArray();

    // ── STATS ──
    const RATE = 1999;
    const thisMonthBk = allBookings.filter(b => b.st !== "cancelled" && new Date(b.ci) >= startOfMonth);
    const lastMonthBk = allBookings.filter(b => b.st !== "cancelled" && new Date(b.ci) >= startOfLastMonth && new Date(b.ci) <= endOfLastMonth);
    const pendingBk = allBookings.filter(b => b.st === "pending");

    const revThis = thisMonthBk.length * RATE;
    const revLast = lastMonthBk.length * RATE;
    const revDiff = revLast > 0 ? Math.round(((revThis - revLast) / revLast) * 100) : 0;
    const totalNonCancelled = allBookings.filter(b => b.st !== "cancelled").length;

    // ── LIVE ROOM STATUS ──
    const rooms = [1, 2].map(r => {
      const cur = allBookings.find(b =>
        b.rm == r && b.st !== "cancelled" &&
        now >= new Date(b.ci) && now < new Date(b.co)
      );
      const pct = cur ? Math.min(100, Math.round(
        ((now - new Date(cur.ci)) / (new Date(cur.co) - new Date(cur.ci))) * 100
      )) : 0;
      return { room: r, occupied: !!cur, guest: cur || null, pct };
    });
    const occupiedCount = rooms.filter(r => r.occupied).length;

    // ── RECENT BOOKINGS (last 6) ──
    const recent = [...allBookings]
      .filter(b => b.st !== "cancelled")
      .sort((a, b) => new Date(b.ci) - new Date(a.ci))
      .slice(0, 6);

    // ── UPCOMING CHECK-INS (next 5) ──
    const upcoming = allBookings
      .filter(b => b.st !== "cancelled" && new Date(b.ci) > now)
      .sort((a, b) => new Date(a.ci) - new Date(b.ci))
      .slice(0, 5);

    // ── BAR CHART (last 12 months) ──
    const barChart = Array.from({ length: 12 }, (_, i) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const count = allBookings.filter(b => {
        const d = new Date(b.ci);
        return d.getFullYear() === month.getFullYear() &&
               d.getMonth() === month.getMonth() &&
               b.st !== "cancelled";
      }).length;
      return { month: month.toLocaleString("default", { month: "short" }), year: month.getFullYear(), count };
    });

    // ── DONUT (this month by room) ──
    const donut = {
      r1: allBookings.filter(b => b.rm == "1" && b.st !== "cancelled" && new Date(b.ci) >= startOfMonth).length,
      r2: allBookings.filter(b => b.rm == "2" && b.st !== "cancelled" && new Date(b.ci) >= startOfMonth).length,
      cancelled: allBookings.filter(b => b.st === "cancelled" && new Date(b.ci) >= startOfMonth).length,
    };

    res.status(200).json({
      stats: {
        revThis, revLast, revDiff,
        totalBookings: totalNonCancelled,
        thisMonthCount: thisMonthBk.length,
        pendingCount: pendingBk.length,
        occupiedCount,
        totalRooms: 2,
      },
      rooms,
      recent,
      upcoming,
      barChart,
      donut,
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    await client.close();
  }
}