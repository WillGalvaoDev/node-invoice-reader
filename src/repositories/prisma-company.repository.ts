import { PrismaClient } from '@prisma/client';
import type { ICompanyRepository, ICompany } from './company.repository.js';
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export class PrismaCompanyRepository implements ICompanyRepository {
  async create(company: ICompany): Promise<ICompany> {
    const createdCompany = await prisma.company.create({
      data: {
        name: company.name,
        cnpj: company.cnpj,
        ownerId: company.ownerId,
      },
    });

    return createdCompany as ICompany;
  }

  async findById(id: string): Promise<ICompany | null> {
    const company = await prisma.company.findUnique({
      where: { id },
    });

    return company as ICompany | null;
  }

  async findByOwnerId(ownerId: string): Promise<ICompany[]> {
    const companies = await prisma.company.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });

    return companies as ICompany[];
  }

  // 👈 Método adicionado:
  async findByCnpj(cnpj: string): Promise<ICompany | null> {
    const company = await prisma.company.findUnique({
      where: { cnpj },
    });

    return company as ICompany | null;
  }
}