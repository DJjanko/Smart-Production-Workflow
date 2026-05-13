import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDb } from "./config/db.js";
import { ActivityLog } from "./models/ActivityLog.js";
import { Employee } from "./models/Employee.js";
import { Inventory } from "./models/Inventory.js";
import { Order } from "./models/Order.js";
import { Part } from "./models/Part.js";
import { PartOrder } from "./models/PartOrder.js";
import { Product } from "./models/Product.js";
import { ProductInventory } from "./models/ProductInventory.js";
import { User } from "./models/User.js";
import { WorkOrder } from "./models/WorkOrder.js";
import { WorkOrderPhase } from "./models/WorkOrderPhase.js";

export async function seedDatabase() {
  const connection = await connectDb();
  await connection.dropDatabase();

  const [adminUser, workerUser] = await User.insertMany([
    {
      name: "Maja Planer",
      email: "admin",
      passwordHash: await bcrypt.hash("admin", 10),
      role: "admin"
    },
    {
      name: "Marko Reznik",
      email: "marko@workorder.ai",
      passwordHash: await bcrypt.hash("password123", 10),
      role: "worker"
    }
  ]);

  const parts = await Part.insertMany([
    { name: "Kovinska plocevina", sku: "PL-001", unit: "kos", minStock: 10 },
    { name: "Vijak M6", sku: "VI-M6", unit: "kos", minStock: 80 },
    { name: "Varilna zica", sku: "VA-001", unit: "kolut", minStock: 5 },
    { name: "DIN letev", sku: "DIN-35", unit: "kos", minStock: 8 },
    { name: "Kabelska uvodnica", sku: "KU-20", unit: "kos", minStock: 25 }
  ]);
  const bySku = Object.fromEntries(parts.map((part) => [part.sku, part]));

  await Inventory.insertMany([
    { partId: bySku["PL-001"]._id, availableQuantity: 18, reservedQuantity: 0, location: "A1" },
    { partId: bySku["VI-M6"]._id, availableQuantity: 140, reservedQuantity: 0, location: "A2" },
    { partId: bySku["VA-001"]._id, availableQuantity: 4, reservedQuantity: 0, location: "B1" },
    { partId: bySku["DIN-35"]._id, availableQuantity: 6, reservedQuantity: 0, location: "C1" },
    { partId: bySku["KU-20"]._id, availableQuantity: 30, reservedQuantity: 0, location: "C2" }
  ]);

  await Employee.insertMany([
    { userId: workerUser._id, name: "Marko Reznik", skills: ["rezanje", "varjenje"], workingHoursPerDay: 8 },
    { name: "Ana Kontrola", skills: ["kontrola", "pakiranje"], workingHoursPerDay: 8 },
    { name: "Tomaz Monter", skills: ["sestavljanje", "kontrola"], workingHoursPerDay: 8 },
    { name: "Sara Elektro", skills: ["elektro montaza", "pakiranje"], workingHoursPerDay: 8 }
  ]);

  const products = await Product.insertMany([
    {
      name: "Kovinsko ohisje A",
      description: "Standardno kovinsko ohisje za industrijsko opremo.",
      requiredParts: [
        { partId: bySku["PL-001"]._id, quantity: 2 },
        { partId: bySku["VI-M6"]._id, quantity: 12 },
        { partId: bySku["VA-001"]._id, quantity: 1 }
      ],
      phases: [
        { name: "Rezanje", requiredSkill: "rezanje", durationMinutes: 60, dependsOn: [] },
        { name: "Varjenje", requiredSkill: "varjenje", durationMinutes: 90, dependsOn: ["Rezanje"] },
        { name: "Kontrola", requiredSkill: "kontrola", durationMinutes: 30, dependsOn: ["Varjenje"] },
        { name: "Pakiranje", requiredSkill: "pakiranje", durationMinutes: 20, dependsOn: ["Kontrola"] }
      ]
    },
    {
      name: "Elektricna omarica B",
      description: "Manjsa elektricna omarica z osnovno DIN montazo.",
      requiredParts: [
        { partId: bySku["PL-001"]._id, quantity: 3 },
        { partId: bySku["VI-M6"]._id, quantity: 16 },
        { partId: bySku["DIN-35"]._id, quantity: 2 },
        { partId: bySku["KU-20"]._id, quantity: 4 }
      ],
      phases: [
        { name: "Rezanje", requiredSkill: "rezanje", durationMinutes: 70, dependsOn: [] },
        { name: "Sestavljanje", requiredSkill: "sestavljanje", durationMinutes: 110, dependsOn: ["Rezanje"] },
        { name: "Elektro montaza", requiredSkill: "elektro montaza", durationMinutes: 80, dependsOn: ["Sestavljanje"] },
        { name: "Kontrola", requiredSkill: "kontrola", durationMinutes: 35, dependsOn: ["Elektro montaza"] },
        { name: "Pakiranje", requiredSkill: "pakiranje", durationMinutes: 25, dependsOn: ["Kontrola"] }
      ]
    }
  ]);

  const productByName = Object.fromEntries(products.map((product) => [product.name, product]));
  await ProductInventory.insertMany([
    { productId: productByName["Kovinsko ohisje A"]._id, availableQuantity: 2, reservedQuantity: 0, location: "P1" },
    { productId: productByName["Elektricna omarica B"]._id, availableQuantity: 0, reservedQuantity: 0, location: "P2" }
  ]);

  await ActivityLog.create({
    actor: adminUser.name,
    action: "seed_database",
    llmProvider: "mock",
    mcpTool: "seed_demo_data",
    input: {},
    output: { products: 2, parts: parts.length },
    durationMs: 0
  });
}

seedDatabase()
  .then(() => {
    console.log("Seed complete. Login with admin / admin");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
