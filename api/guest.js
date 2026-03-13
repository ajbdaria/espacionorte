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

    const [allBookings, allUsers] = await Promise.all([
      db.collection("bookings").find({}).toArray(),
      db.collection("users").find({}, {
        projection: { password: 0 }
      }).toArray(),
    ]);

    // Build a quick lookup map: username → user profile
    const userByUsername = {};
    allUsers.forEach(u => {
      if (u.username) userByUsername[u.username] = u;
    });

    // ── BUILD GUEST DIRECTORY ──
    // Key by guestUser (username) first, fallback to phone number
    const guestMap = {};

    allBookings.forEach(b => {
      // Determine the best key and profile source
      const key = b.guestUser || b.ph || `anon-${b.ref}`;

      // Try to get enriched info from users collection
      const userProfile = b.guestUser ? userByUsername[b.guestUser] : null;

      // Resolve display fields — prefer user profile, fallback to booking fields
      const fullName = userProfile?.name
        || [b.fn, b.ln].filter(Boolean).join(' ').trim()
        || 'Unknown Guest';

      const nameParts = fullName.split(' ');
      const fn = nameParts[0] || b.fn || '';
      const ln = nameParts.slice(1).join(' ') || b.ln || '';

      const ph = userProfile?.phone || b.ph || '';
      const em = userProfile?.email || b.em || '';

      // Extra profile fields from users collection
      const address  = userProfile?.address  || '';
      const city     = userProfile?.city     || '';
      const region   = userProfile?.region   || '';
      const ecname   = userProfile?.ecname   || '';
      const ecrel    = userProfile?.ecrel    || '';
      const ecphone  = userProfile?.ecphone  || '';
      const idtype   = userProfile?.idtype   || '';
      const idnum    = userProfile?.idnum    || '';
      const username = b.guestUser           || '';

      if (!guestMap[key]) {
        guestMap[key] = {
          fn, ln, ph, em,
          address, city, region,
          ecname, ecrel, ecphone,
          idtype, idnum,
          username,
          bookings: [],
        };
      } else {
        // Update with better data if we now have a profile
        if (userProfile) {
          guestMap[key].fn      = fn;
          guestMap[key].ln      = ln;
          guestMap[key].ph      = ph || guestMap[key].ph;
          guestMap[key].em      = em || guestMap[key].em;
          guestMap[key].address = address || guestMap[key].address;
          guestMap[key].city    = city    || guestMap[key].city;
          guestMap[key].region  = region  || guestMap[key].region;
          guestMap[key].ecname  = ecname  || guestMap[key].ecname;
          guestMap[key].ecphone = ecphone || guestMap[key].ecphone;
          guestMap[key].idtype  = idtype  || guestMap[key].idtype;
          guestMap[key].idnum   = idnum   || guestMap[key].idnum;
        }
      }

      guestMap[key].bookings.push({
        _id:     b._id,
        ref:     b.ref,
        rm:      b.rm,
        ci:      b.ci,
        co:      b.co,
        px:      b.px,
        st:      b.st,
        nt:      b.nt   || "",
        pay:     b.pay  || "",
        created: b.created || null,
      });
    });

    // ── ENRICH & SORT ──
    const guests = Object.values(guestMap).map(g => {
      const nonCancelled = g.bookings.filter(b => b.st !== "cancelled");
      const completed    = g.bookings.filter(b => b.st === "checkedout");
      const upcoming     = g.bookings.filter(b =>
        !["cancelled","checkedout","checkedin"].includes(b.st)
      );
      const totalSpent = completed.length * RATE;
      const lastStay   = [...completed].sort(
        (a, b) => new Date(b.ci) - new Date(a.ci)
      )[0] || null;

      // Sort bookings newest first
      g.bookings.sort((a, b) => new Date(b.ci) - new Date(a.ci));

      return {
        ...g,
        stats: {
          totalBookings:    g.bookings.length,
          nonCancelled:     nonCancelled.length,
          completedStays:   completed.length,
          upcomingBookings: upcoming.length,
          totalSpent,
          lastStay: lastStay ? lastStay.ci : null,
        },
      };
    });

    // Sort by most non-cancelled bookings descending
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