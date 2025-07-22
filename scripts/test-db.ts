import "dotenv/config";
import { db } from "@/lib/db";

async function testConnection() {
  try {
    // Try a simple query
    const result = await db.execute("SELECT 1 as test");
    console.log("Database connection successful:", result);
  } catch (error) {
    console.error("Database connection failed:", error);
  }
}

testConnection(); 