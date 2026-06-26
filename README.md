# DocScan - Intelligent DANFE Parser for Brazilian Invoices

An enterprise-grade **DANFE** (Documento Auxiliar da Nota Fiscal Eletrônica) intelligent parsing ecosystem built with **Node.js**, **TypeScript**, and **Clean Architecture**. This project delivers a robust, non-blocking backend solution specifically tailored to optimize workflows for Brazilian local workers and accounting teams by automating financial data extraction.

## 🎯 Project Purpose

Processing Brazilian fiscal documents (DANFEs/NF-es) is notoriously complex due to strict SEFAZ standards, multi-layered tax structures (ICMS, IPI, PIS, COFINS), and diverse layout formats. This system orchestrates an automated pipeline that:
1. Ingests local fiscal documents (PDFs, Images, or text representations).
2. Leverages specialized AI Providers (Gemini/OpenAI) to intelligently extract structured fiscal entities (e.g., 44-digit Access Keys, Issuer CNPJ, Line Items, and Tax Breakdown).
3. Enforces Brazilian fiscal validation rules at the core domain layer.
4. Normalizes and persists data into downstream repositories, eliminating manual typing errors for local businesses.

---

## 🏗️ Architectural Overview

The codebase strictly follows **Clean Architecture** and **SOLID** paradigms to decouple local tax legislation and third-party tools from the core application logic.

### Directory Structure & Responsibilities

* **`src/entities/`**: Core Business Domain. Contains pure fiscal domain constraints (e.g., `Danfe`, `ProductItem`, `Issuer`). This layer enforces that an Access Key must be exactly 44 digits and that CNPJs must match national formatting algorithms, completely independent of databases or APIs.
* **`src/use-cases/`**: Application Logic / Flow Marshals. Orchestrates processing flows, such as `ProcessDanfeUseCase`, managing the sequence from file reading to AI extraction, domain validation, and repository storage.
* **`src/providers/`**: External Integration Bridges. Houses abstract contracts and concrete implementations for third-party tools. This isolates file storage (`IStorageProvider`) and LLM processing engines (`IAiProvider`), allowing seamless swaps between AI models.
* **`src/repositories/`**: Database Gateways. Handles data access layer operations (CRUD). Abstracts the database technology (PostgreSQL, MongoDB, Prisma, etc.), isolating the core from SQL or NoSQL specific details.
* **`src/controllers/`**: HTTP Request Reception. Acts as the interface gatekeeper. Captures file uploads from multi-part API routes, delegates payloads to Use Cases, and formats fiscal responses back to the client.

---

## ⚡ Core Technical Principles

* **Single-Threaded Event Loop & Non-Blocking I/O**: Engineered to absorb high-volume invoice batches during peak accounting periods (e.g., end-of-month closings) without freezing the main application process.
* **Dependency Injection (DI)**: Components connect strictly via interfaces. You can swap a local file system provider for a cloud storage provider (like AWS S3) without changing a single line of fiscal business logic.
* **Cost-Efficient Resource Allocation**: Shunts processing queues away from expensive application servers onto background workers and optimized database pools, maximizing hardware ROI on cloud infrastructure.

---

## 🚀 Getting Started

### Prerequisites

* Node.js (v20+ recommended)
* npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git](https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git)
   cd docscan