import '../prisma.config.js'; // Garante o registro do prisma antes de tudo
import express from 'express';
import cors from 'cors';
import { routes } from './routes.js';
import { errorHandler } from './middlewares/error-handler.js';

const app = express();

app.use(cors());

// Middleware para decodificar JSON no corpo das requisições
app.use(express.json());

// Acopla as nossas rotas estruturadas (Multer, Rotas e Controllers)
app.use(routes);
app.use(errorHandler);

const PORT = process.env['PORT'] || 3333;

app.listen(PORT, () => {
  console.log(`🚀 Servidor HTTP do DocScan rodando na porta ${PORT}!`);
});