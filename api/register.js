import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {

    await client.connect();
    const db = client.db("espacionorte");

    const { name, username, password } = req.body;

    const exist = await db.collection("users").findOne({ username });

    if (exist) {
      return res.status(400).json({ message:"Username already exists" });
    }

    await db.collection("users").insertOne({
      name,
      username,
      password,
      role:"guest",
      created:new Date()
    });

    res.status(200).json({ success:true });

  } catch (error) {

    res.status(500).json({ message:"Server error" });

  }

}