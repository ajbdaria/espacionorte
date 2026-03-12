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

    // ── YEAR PARAM ──
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const allBookings = await db.collection("bookings").find({}).toArray();

    const yearBookings = allBookings.filter(b => new Date(b.ci).getFullYear() === year);

    // ── MONTHLY BREAKDOWN ──
    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];

    const monthly = months.map((name, i) => {
      const bks = yearBookings.filter(b => {
        return new Date(b.ci).getMonth() === i && b.st !== "cancelled";
      });
      const r1 = bks.filter(b => b.rm == 1).length;
      const r2 = bks.filter(b => b.rm == 2).length;
      return {
        month: name,
        index: i,
        bookings: bks.length,
        revenue: bks.length * RATE,
        r1,
        r2,
      };
    });

    // ── KPI AGGREGATES ──
    const totalBookings = monthly.reduce((s, m) => s + m.bookings, 0);
    const totalRevenue  = monthly.reduce((s, m) => s + m.revenue, 0);
    const cancellations = yearBookings.filter(b => b.st === "cancelled").length;
    const avgPerMonth   = totalBookings / 12;
    const avgRevPerBooking = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;

    const maxBookings = Math.max(...monthly.map(m => m.bookings), 1);
    const busiestIdx  = monthly.findIndex(m => m.bookings === maxBookings);
    const slowestIdx  = monthly.reduce((bi, m, i) =>
      m.bookings < monthly[bi].bookings ? i : bi, 0
    );

    // ── ROOM TOTALS ──
    const totalR1 = monthly.reduce((s, m) => s + m.r1, 0);
    const totalR2 = monthly.reduce((s, m) => s + m.r2, 0);

    // ── INSIGHTS ──
    const insights = {
      bestMonth:   { name: months[busiestIdx], bookings: monthly[busiestIdx].bookings, revenue: monthly[busiestIdx].revenue },
      worstMonth:  { name: months[slowestIdx], bookings: monthly[slowestIdx].bookings, revenue: monthly[slowestIdx].revenue },
      popularRoom: totalR1 >= totalR2 ? "Suite 1" : "Suite 2",
      r1Total:     totalR1,
      r2Total:     totalR2,
      cancellations,
    };

    // ── YEAR-OVER-YEAR COMPARISON (vs previous year) ──
    const prevYearBk = allBookings.filter(b => {
      return new Date(b.ci).getFullYear() === year - 1 && b.st !== "cancelled";
    });
    const prevRevenue  = prevYearBk.length * RATE;
    const revYoY       = prevRevenue > 0
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
      : null;
    const bkYoY        = prevYearBk.length > 0
      ? Math.round(((totalBookings - prevYearBk.length) / prevYearBk.length) * 100)
      : null;

    // ── AVAILABLE YEARS (for dropdown) ──
    const allYears = [...new Set(allBookings.map(b => new Date(b.ci).getFullYear()))]
      .sort((a, b) => b - a);

    res.status(200).json({
      year,
      kpis: {
        totalRevenue,
        totalBookings,
        cancellations,
        avgPerMonth: parseFloat(avgPerMonth.toFixed(1)),
        avgRevPerBooking,
        busiestMonth: months[busiestIdx],
        revYoY,
        bkYoY,
      },
      monthly,
      insights,
      availableYears: allYears.length > 0 ? allYears : [year],
    });

  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    await client.close();
  }
}