import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDb } from "./config/db.js";
import { Employee } from "./models/Employee.js";
import { Inventory } from "./models/Inventory.js";
import { Order } from "./models/Order.js";
import { Part } from "./models/Part.js";
import { Product } from "./models/Product.js";
import { ProductInventory } from "./models/ProductInventory.js";
import { User } from "./models/User.js";
import { WorkOrder } from "./models/WorkOrder.js";
import { WorkOrderPhase } from "./models/WorkOrderPhase.js";

export async function seedDatabase() {
  const connection = await connectDb();
  await connection.dropDatabase();

  const [adminUser, markoUser, saraUser, tomazUser] = await User.insertMany([
    { name: "Maja Planer",    email: "admin",            passwordHash: await bcrypt.hash("admin", 10),       role: "admin" },
    { name: "Marko Reznik",   email: "marko",             passwordHash: await bcrypt.hash("marko123", 10),    role: "worker" },
    { name: "Sara Elektro",   email: "sara@factory.si",  passwordHash: await bcrypt.hash("password123", 10), role: "worker" },
    { name: "Tomaz Monter",   email: "tomaz@factory.si", passwordHash: await bcrypt.hash("password123", 10), role: "worker" }
  ]);

  await Employee.insertMany([
    { userId: markoUser._id, name: "Marko Reznik",   skills: ["rezanje", "varjenje", "programiranje"], workingHoursPerDay: 8 },
    { name: "Aneja Kontrola",  skills: ["kontrola", "pakiranje", "spajkanje"],                          workingHoursPerDay: 8 },
    { userId: tomazUser._id, name: "Tomaz Monter",   skills: ["sestavljanje", "kontrola"],              workingHoursPerDay: 8 },
    { userId: saraUser._id,  name: "Sara Elektro",   skills: ["elektro montaza", "pakiranje"],          workingHoursPerDay: 8 },
    { name: "Tomaz Programer", skills: ["programiranje"],                                               workingHoursPerDay: 8 }
  ]);

  const parts = await Part.insertMany([
    { name: "Kovinska plocevina", sku: "PL-001", unit: "kos",   minStock: 10 },
    { name: "Vijak M6",           sku: "VI-M6",  unit: "kos",   minStock: 80 },
    { name: "Vijak M8",           sku: "VI-08",  unit: "kos",   minStock: 20 },
    { name: "Varilna zica",       sku: "VA-001", unit: "kolut", minStock: 5  },
    { name: "DIN letev",          sku: "DIN-35", unit: "kos",   minStock: 8  },
    { name: "Kabelska uvodnica",  sku: "KU-20",  unit: "kos",   minStock: 25 },
    { name: "Gumijasto tesnilje", sku: "GT-10",  unit: "kos",   minStock: 15 },
    { name: "Bat cilinder",       sku: "BC-50",  unit: "kos",   minStock: 4  }
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

  const product = await Product.create({
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
  });

  await ProductInventory.create({
    productId: product._id,
    availableQuantity: 0,
    reservedQuantity: 0,
    location: "P1"
  });

  // Order brez delovnega naloga
  await Order.create({
    customerName: "AluTech",
    items: [{ productId: product._id, productName: product.name, quantity: 3 }],
    requestedDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: "draft"
  });

  // Order z delovnim nalogom in fazami
  const linkedOrder = await Order.create({
    customerName: "Bauhaus",
    items: [{ productId: product._id, productName: product.name, quantity: 2 }],
    requestedDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: "confirmed"
  });

  const [empMarko, empAneja, empTomaz, empSara] = await Employee.find().sort({ name: 1 });

  const workOrder = await WorkOrder.create({
    code: "WO-001",
    orderId: linkedOrder._id,
    items: [{ productId: product._id, productName: product.name, quantity: 2, fromStock: 0, toProduce: 2 }],
    status: "in_progress",
    inventoryStatus: "available",
    startDate: new Date(),
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  });

  const now = new Date();
  const phases = [
    { name: "Rezanje",   skill: "rezanje",  duration: 60, employee: empMarko, offset: 0 },
    { name: "Varjenje",  skill: "varjenje", duration: 90, employee: empMarko, offset: 60 },
    { name: "Kontrola",  skill: "kontrola", duration: 30, employee: empAneja, offset: 150 },
    { name: "Pakiranje", skill: "pakiranje",duration: 20, employee: empSara,  offset: 180 }
  ];

  const productId = product._id;
  const workOrderId = workOrder._id;
  const phaseDocs = [];
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    phaseDocs.push({
      workOrderId,
      productId,
      name: p.name,
      requiredSkill: p.skill,
      durationMinutes: p.duration,
      assignedTo: p.employee?._id,
      assignedToName: p.employee?.name || "",
      status: p.offset < 60 ? "completed" : p.offset < 90 ? "in_progress" : "planned",
      start: new Date(now.getTime() + p.offset * 60000),
      end: new Date(now.getTime() + (p.offset + p.duration) * 60000),
      dependsOn: i === 0 ? [] : [phases[i - 1].name]
    });
  }
  await WorkOrderPhase.insertMany(phaseDocs);

  console.log("── Empty seed complete ───────────────────────────");
  console.log("Admin:   admin / admin");
  console.log("Workers: marko / marko123");
  console.log("         sara@factory.si  / password123");
  console.log("         tomaz@factory.si / password123");
  console.log("Parts:  ", parts.map((p) => p.sku).join(", "));
  console.log("Product: Kovinsko ohisje A (4 faze)");
  console.log("Order 1: AluTech, 3x Kovinsko ohisje A (brez delovnega naloga)");
  console.log("Order 2: Bauhaus, 2x Kovinsko ohisje A → WO-001 (4 faze, dodeljene zaposlenim)");
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
