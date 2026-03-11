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

    const { username, password } = req.body;

    const user = await db.collection("users").findOne({
      username: username,
      password: password
    });

    if (!user) {
      return res.status(401).json({ success:false, message:"Invalid credentials" });
    }

    res.status(200).json({
      success:true,
      role:user.role,
      username:user.username
    });

  } catch (error) {

    res.status(500).json({ message:"Server error" });

  }

}