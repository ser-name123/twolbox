// Seeds sample groups/products on an empty database. Safe to re-run: does nothing if products exist.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL! }) });

async function main() {
  if (await prisma.product.count()) {
    console.log("Products already exist — skipping seed.");
    return;
  }
  const [fasteners, handTools, power] = await Promise.all([
    prisma.group.create({ data: { name: "Fasteners", hsn: "7318" } }),
    prisma.group.create({ data: { name: "Hand Tools", hsn: "8204" } }),
    prisma.group.create({ data: { name: "Power Tool Accessories", hsn: "8207" } }),
  ]);
  await prisma.product.createMany({
    data: [
      { code: 1001, groupId: fasteners.id, name: "M8 x 25mm Hex Bolt", price: 8.5, hsn: "7318", narration: "Zinc coated, rust resistant" },
      { code: 1002, groupId: fasteners.id, name: "M10 Nut", price: 3.0, hsn: "7318" },
      { code: 1003, groupId: handTools.id, name: '12" Adjustable Wrench', price: 245.0, hsn: "8204", narration: "Chrome vanadium body" },
      { code: 1004, groupId: handTools.id, name: "Claw Hammer 500g", price: 310.0, hsn: "8204", narration: "Fibreglass handle" },
      { code: 1005, groupId: power.id, name: "HSS Drill Bit 6mm", price: 95.0, hsn: "8207", narration: "For steel & metal drilling" },
    ],
  });
  await prisma.setting.upsert({ where: { key: "orderingEnabled" }, create: { key: "orderingEnabled", value: true }, update: {} });
  console.log("Seeded 3 groups and 5 products (codes 1001–1005).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
