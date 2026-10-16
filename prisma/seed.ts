// Datos iniciales: categorías, productos de ejemplo, configuración y usuario admin.
// Ejecutar con: npm run db:seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { slugify } from "../src/lib/slug";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

const categories = [
  { name: "Bebidas", emoji: "🥤" },
  { name: "Botanas y dulces", emoji: "🍿" },
  { name: "Lácteos y huevo", emoji: "🥛" },
  { name: "Panadería y tortillas", emoji: "🍞" },
  { name: "Despensa", emoji: "🥫" },
  { name: "Frutas y verduras", emoji: "🥑" },
  { name: "Limpieza", emoji: "🧼" },
  { name: "Cuidado personal", emoji: "🧴" },
];

// [nombre, categoría, precio en pesos, unidad, stock, destacado, precio anterior]
type Row = [string, string, number, string, number, boolean?, number?];
const products: Row[] = [
  ["Refresco de cola 600 ml", "Bebidas", 20, "pieza", 48, true],
  ["Refresco de cola 2 L", "Bebidas", 42, "pieza", 24],
  ["Agua natural 1.5 L", "Bebidas", 15, "pieza", 36],
  ["Jugo de naranja 1 L", "Bebidas", 32, "pieza", 12],
  ["Agua mineral 600 ml", "Bebidas", 18, "pieza", 20],
  ["Papas fritas sal 45 g", "Botanas y dulces", 19, "pieza", 30, true],
  ["Cacahuates japoneses 100 g", "Botanas y dulces", 22, "pieza", 15],
  ["Galletas de chocolate 4 pzas", "Botanas y dulces", 18, "paquete", 25],
  ["Chocolate en barra 40 g", "Botanas y dulces", 16, "pieza", 3],
  ["Leche entera 1 L", "Lácteos y huevo", 28, "pieza", 40, true],
  ["Huevo blanco", "Lácteos y huevo", 48, "kg", 20, true, 52],
  ["Queso fresco 400 g", "Lácteos y huevo", 65, "pieza", 8],
  ["Yogur natural 1 L", "Lácteos y huevo", 38, "pieza", 10],
  ["Crema ácida 200 ml", "Lácteos y huevo", 22, "pieza", 2],
  ["Pan de caja blanco grande", "Panadería y tortillas", 52, "pieza", 15, true],
  ["Tortillas de maíz", "Panadería y tortillas", 24, "kg", 30],
  ["Tortillas de harina 10 pzas", "Panadería y tortillas", 30, "paquete", 12],
  ["Arroz blanco 1 kg", "Despensa", 32, "pieza", 25],
  ["Frijol negro 1 kg", "Despensa", 38, "pieza", 22, true],
  ["Aceite vegetal 900 ml", "Despensa", 45, "pieza", 18, false, 49],
  ["Azúcar estándar 1 kg", "Despensa", 30, "pieza", 20],
  ["Sopa de pasta 200 g", "Despensa", 9, "pieza", 60],
  ["Atún en agua 140 g", "Despensa", 24, "lata", 30],
  ["Chiles jalapeños 220 g", "Despensa", 18, "lata", 14],
  ["Café soluble 120 g", "Despensa", 78, "frasco", 9],
  ["Jitomate saladet", "Frutas y verduras", 28, "kg", 15],
  ["Cebolla blanca", "Frutas y verduras", 24, "kg", 12],
  ["Aguacate hass", "Frutas y verduras", 75, "kg", 6, true],
  ["Plátano", "Frutas y verduras", 22, "kg", 18],
  ["Limón sin semilla", "Frutas y verduras", 35, "kg", 4],
  ["Detergente en polvo 1 kg", "Limpieza", 42, "pieza", 14],
  ["Cloro 1 L", "Limpieza", 18, "pieza", 20],
  ["Lavatrastes líquido 750 ml", "Limpieza", 35, "pieza", 11],
  ["Papel higiénico 4 rollos", "Cuidado personal", 36, "paquete", 25],
  ["Jabón de tocador 150 g", "Cuidado personal", 17, "pieza", 30],
  ["Pasta dental 100 ml", "Cuidado personal", 32, "pieza", 16],
  ["Shampoo 400 ml", "Cuidado personal", 58, "pieza", 0],
];

async function main() {
  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      announcement: "🚚 Envío gratis en pedidos desde $300",
      phone: "55 1234 5678",
      whatsapp: "5215512345678",
      address: "Av. Universidad 123, Col. Centro",
    },
  });

  const email = process.env.ADMIN_EMAIL ?? "admin@launiversal.mx";
  const password = process.env.ADMIN_PASSWORD ?? "cambiame123";
  await db.adminUser.upsert({
    where: { email },
    update: {},
    create: { email, name: "Administrador", passwordHash: await bcrypt.hash(password, 10) },
  });

  if ((await db.promotion.count()) === 0) {
    await db.promotion.create({
      data: { name: "15% de descuento pagando con tarjeta o transferencia", kind: "PERCENT", value: 15, paymentMethods: "CARD,TRANSFER" },
    });
  }

  if ((await db.product.count()) > 0) {
    console.log("Ya hay productos; solo se aseguraron configuración y usuario admin.");
    return;
  }

  const categoryIds = new Map<string, number>();
  for (const [i, c] of categories.entries()) {
    const created = await db.category.create({
      data: { ...c, slug: slugify(c.name), sortOrder: i },
    });
    categoryIds.set(c.name, created.id);
  }

  for (const [name, category, price, unit, stock, featured, compareAt] of products) {
    const product = await db.product.create({
      data: {
        name,
        slug: slugify(name),
        price: price * 100,
        compareAtPrice: compareAt ? compareAt * 100 : null,
        unit,
        stock,
        featured: featured ?? false,
        categoryId: categoryIds.get(category),
      },
    });
    if (stock > 0) {
      await db.stockMovement.create({
        data: { productId: product.id, change: stock, stockAfter: stock, reason: "RESTOCK", note: "Inventario inicial" },
      });
    }
  }

  console.log(`Listo: ${categories.length} categorías y ${products.length} productos.`);
  console.log(`Admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
