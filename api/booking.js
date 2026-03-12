import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

export default async function handler(req, res) {

  try {

    await client.connect();
    const db = client.db("espacionorte");

    if (req.method === "POST") {
      await db.collection("bookings").insertOne(req.body);
      return res.status(200).json({ success: true, message: "Booking saved" });
    }

    if (req.method === "GET") {
      const bookings = await db.collection("bookings").find({}).toArray();
      return res.status(200).json(bookings);
    }

    res.status(405).json({ message: "Method not allowed" });

  } catch (error) {

    console.error("Booking error:", error);
    res.status(500).json({ success: false, message: "Server error" });

  } finally {

    await client.close();

  }

}git