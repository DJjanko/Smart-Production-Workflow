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
import { SupplyAlert } from "./models/SupplyAlert.js";
import { User } from "./models/User.js";
import { WorkOrder } from "./models/WorkOrder.js";
import { WorkOrderPhase } from "./models/WorkOrderPhase.js";

export async function seedDatabase() {
  const connection = await connectDb();
  await connection.dropDatabase();

  // ── Users ──────────────────────────────────────────────
  const [adminUser, markoUser, saraUser, tomazUser] = await User.insertMany([
    { name: "Maja Planer", email: "admin", passwordHash: await bcrypt.hash("admin", 10), role: "admin" },
    { name: "Marko Reznik", email: "marko@factory.si", passwordHash: await bcrypt.hash("password123", 10), role: "worker" },
    { name: "Sara Elektro", email: "sara@factory.si", passwordHash: await bcrypt.hash("password123", 10), role: "worker" },
    { name: "Tomaz Monter", email: "tomaz@factory.si", passwordHash: await bcrypt.hash("password123", 10), role: "worker" }
  ]);

  // ── Parts ──────────────────────────────────────────────
  const parts = await Part.insertMany([
    { name: "Kovinska plocevina", sku: "PL-001", unit: "kos", minStock: 10 },
    { name: "Vijak M6",           sku: "VI-M6",  unit: "kos", minStock: 80 },
    { name: "Vijak M8",           sku: "VI-08",  unit: "kos", minStock: 20 },
    { name: "Varilna zica",       sku: "VA-001", unit: "kolut", minStock: 5 },
    { name: "DIN letev",          sku: "DIN-35", unit: "kos", minStock: 8 },
    { name: "Kabelska uvodnica",  sku: "KU-20",  unit: "kos", minStock: 25 },
    { name: "Gumijasto tesnilje", sku: "GT-10",  unit: "kos", minStock: 15 },
    { name: "Bat cilinder",       sku: "BC-50",  unit: "kos", minStock: 4 }
  ]);
  const bySku = Object.fromEntries(parts.map((p) => [p.sku, p]));

  await Inventory.insertMany([
    { partId: bySku["PL-001"]._id, availableQuantity: 18,  reservedQuantity: 0, location: "A1" },
    { partId: bySku["VI-M6"]._id,  availableQuantity: 140, reservedQuantity: 0, location: "A2" },
    { partId: bySku["VI-08"]._id,  availableQuantity: 35,  reservedQuantity: 0, location: "A3" },
    { partId: bySku["VA-001"]._id, availableQuantity: 3,   reservedQuantity: 0, location: "B1" },
    { partId: bySku["DIN-35"]._id, availableQuantity: 6,   reservedQuantity: 0, location: "C1" },
    { partId: bySku["KU-20"]._id,  availableQuantity: 28,  reservedQuantity: 0, location: "C2" },
    { partId: bySku["GT-10"]._id,  availableQuantity: 0,   reservedQuantity: 0, location: "D1" },
    { partId: bySku["BC-50"]._id,  availableQuantity: 2,   reservedQuantity: 0, location: "D2" }
  ]);

  // ── Employees ──────────────────────────────────────────
  const [empMarko, empAneja, empTomaz, empSara, empProgramer] = await Employee.insertMany([
    { userId: markoUser._id, name: "Marko Reznik",    skills: ["rezanje", "varjenje", "programiranje"], workingHoursPerDay: 8 },
    { name: "Aneja Kontrola",  skills: ["kontrola", "pakiranje", "spajkanje"],   workingHoursPerDay: 8 },
    { userId: tomazUser._id, name: "Tomaz Monter",    skills: ["sestavljanje", "kontrola"],              workingHoursPerDay: 8 },
    { userId: saraUser._id,  name: "Sara Elektro",    skills: ["elektro montaza", "pakiranje"],          workingHoursPerDay: 8 },
    { name: "Tomaz Programer", skills: ["programiranje"],                                                workingHoursPerDay: 8 }
  ]);

  // ── Products ───────────────────────────────────────────
  const products = await Product.insertMany([
    {
      name: "Kovinsko ohisje A",
      description: "Standardno kovinsko ohisje za industrijsko opremo.",
      requiredParts: [
        { partId: bySku["PL-001"]._id, quantity: 2 },
        { partId: bySku["VI-M6"]._id,  quantity: 12 },
        { partId: bySku["VA-001"]._id, quantity: 1 }
      ],
      phases: [
        { name: "Rezanje",   requiredSkill: "rezanje",  durationMinutes: 60, dependsOn: [] },
        { name: "Varjenje",  requiredSkill: "varjenje", durationMinutes: 90, dependsOn: ["Rezanje"] },
        { name: "Kontrola",  requiredSkill: "kontrola", durationMinutes: 30, dependsOn: ["Varjenje"] },
        { name: "Pakiranje", requiredSkill: "pakiranje",durationMinutes: 20, dependsOn: ["Kontrola"] }
      ]
    },
    {
      name: "Elektricna omarica B",
      description: "Manjsa elektricna omarica z osnovno DIN montazo.",
      requiredParts: [
        { partId: bySku["PL-001"]._id, quantity: 3 },
        { partId: bySku["VI-M6"]._id,  quantity: 16 },
        { partId: bySku["DIN-35"]._id, quantity: 2 },
        { partId: bySku["KU-20"]._id,  quantity: 4 }
      ],
      phases: [
        { name: "Rezanje",        requiredSkill: "rezanje",        durationMinutes: 70,  dependsOn: [] },
        { name: "Sestavljanje",   requiredSkill: "sestavljanje",   durationMinutes: 110, dependsOn: ["Rezanje"] },
        { name: "Elektro montaza",requiredSkill: "elektro montaza",durationMinutes: 80,  dependsOn: ["Sestavljanje"] },
        { name: "Kontrola",       requiredSkill: "kontrola",       durationMinutes: 35,  dependsOn: ["Elektro montaza"] },
        { name: "Pakiranje",      requiredSkill: "pakiranje",      durationMinutes: 25,  dependsOn: ["Kontrola"] }
      ]
    },
    {
      name: "Pumpa",
      description: "Hidravlicno olje pumpa za industrijske stroje.",
      requiredParts: [
        { partId: bySku["BC-50"]._id,  quantity: 2 },
        { partId: bySku["GT-10"]._id,  quantity: 4 },
        { partId: bySku["VI-08"]._id,  quantity: 8 }
      ],
      phases: [
        { name: "Sestavljanje", requiredSkill: "sestavljanje", durationMinutes: 120, dependsOn: [] },
        { name: "Varjenje",     requiredSkill: "varjenje",     durationMinutes: 60,  dependsOn: ["Sestavljanje"] },
        { name: "Kontrola",     requiredSkill: "kontrola",     durationMinutes: 45,  dependsOn: ["Varjenje"] },
        { name: "Pakiranje",    requiredSkill: "pakiranje",    durationMinutes: 30,  dependsOn: ["Kontrola"] }
      ]
    },
    {
      name: "Lopata",
      description: "Industrijska lopata za kopanje.",
      requiredParts: [
        { partId: bySku["VI-08"]._id,  quantity: 4 },
        { partId: bySku["VA-001"]._id, quantity: 1 }
      ],
      phases: [
        { name: "Sestavljanje", requiredSkill: "sestavljanje", durationMinutes: 30, dependsOn: [] },
        { name: "Pakiranje",    requiredSkill: "pakiranje",    durationMinutes: 15, dependsOn: ["Sestavljanje"] }
      ]
    }
  ]);

  const byName = Object.fromEntries(products.map((p) => [p.name, p]));

  await ProductInventory.insertMany([
    { productId: byName["Kovinsko ohisje A"]._id,   availableQuantity: 3, reservedQuantity: 0, location: "P1" },
    { productId: byName["Elektricna omarica B"]._id, availableQuantity: 5, reservedQuantity: 0, location: "P2" },
    { productId: byName["Pumpa"]._id,                availableQuantity: 0, reservedQuantity: 0, location: "P3" },
    { productId: byName["Lopata"]._id,               availableQuantity: 2, reservedQuantity: 0, location: "P4" }
  ]);

  // ── Supply alert (low stock example) ──────────────────
  await SupplyAlert.insertMany([
    {
      createdBy: markoUser._id,
      createdByName: "Marko Reznik",
      partId: bySku["VA-001"]._id,
      message: "Varilna zica skoraj zmanjkuje — ostanejo le 3 koluti.",
      status: "open"
    },
    {
      createdBy: markoUser._id,
      createdByName: "Marko Reznik",
      partId: bySku["GT-10"]._id,
      message: "Gumijasto tesnilje ni na zalogi.",
      status: "open"
    }
  ]);

  await ActivityLog.create({
    actor: adminUser.name,
    action: "seed_database",
    llmProvider: "mock",
    mcpTool: "seed_demo_data_v2",
    input: {},
    output: { products: products.length, parts: parts.length, employees: 5 },
    durationMs: 0
  });

  console.log("── Seed v2 complete ──────────────────────────────");
  console.log("Admin login:  admin / admin");
  console.log("Worker login: marko@factory.si / password123");
  console.log("             sara@factory.si  / password123");
  console.log("             tomaz@factory.si / password123");
  console.log("Products:", products.map((p) => p.name).join(", "));
  console.log("Parts:   ", parts.map((p) => p.sku).join(", "));
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
