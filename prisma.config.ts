import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"]!, // <-- ADICIONE ISSO AQUI para alimentar o migrate CLI!
  },
  migrations: {
    path: "prisma/migrations",
  },
});
