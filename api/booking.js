import express from "express";
import { MongoClient } from "mongodb";

const router = express.Router();

// POST — save a booking
router.post("/booking", async (req, res) => {

  const client = new MongoClient(process.env.MONGODB_URI);

  try {

    await client.connect();
    const db = client.db("espacionorte");

    const data = req.body;
    await db.collection("bookings").insertOne(data);

    res.status(200).json({ success: true, message: "Booking saved" });

  } catch (error) {

    console.error("Booking error:", error);
    res.status(500).json({ success: false, message: "Server error" });

  } finally {

    await client.close();

  }

});

// GET — fetch all bookings
router.get("/booking", async (req, res) => {

  const client = new MongoClient(process.env.MONGODB_URI);

  try {

    await client.connect();
    const db = client.db("espacionorte");

    const bookings = await db.collection("bookings").find({}).toArray();
    res.status(200).json(bookings);

  } catch (error) {

    console.error("Fetch bookings error:", error);
    res.status(500).json({ success: false, message: "Server error" });

  } finally {

    await client.close();

  }

});

export default router;