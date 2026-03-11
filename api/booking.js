import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri);
  global._mongoClientPromise = client.connect();
}

clientPromise = global._mongoClientPromise;

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("espacionorte");

  if (req.method === "POST") {
    const data = req.body;

    await db.collection("bookings").insertOne(data);

    res.status(200).json({ message: "Booking saved" });
  }

  if (req.method === "GET") {
    const bookings = await db.collection("bookings").find({}).toArray();
    res.status(200).json(bookings);
  }
}