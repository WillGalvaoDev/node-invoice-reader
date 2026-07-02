# DocScan - Intelligent DANFE Parser for Brazilian Invoices

An enterprise-grade **DANFE** (Documento Auxiliar da Nota Fiscal Eletrônica) intelligent parsing ecosystem built with **Node.js**, **TypeScript**, and **Clean Architecture**. This project delivers a robust, non-blocking backend solution specifically tailored to optimize workflows for Brazilian local workers and accounting teams by automating financial data extraction.

## 🎯 Project Purpose

Processing Brazilian fiscal documents (DANFEs/NF-es) is notoriously complex due to strict SEFAZ standards, multi-layered tax structures, and diverse layout formats. This system orchestrates an automated pipeline that:
1. Ingests local fiscal documents text representations.
2. Leverages specialized AI Providers (Google Gemini) to intelligently extract structured fiscal entities (e.g., 44-digit Access Keys, Issuer CNPJ, Line Items, and Tax Breakdown) using strict JSON schemas.
3. Enforces Brazilian fiscal validation rules at the core domain layer.
4. Prepares the normalized data to seamlessly increment inventory stock and map local suppliers.

---

## 🏗️ Architectural Overview

The codebase strictly follows **Clean Architecture** and **SOLID** paradigms to decouple local tax legislation and third-party tools from the core application logic.

### Directory Structure & Responsibilities

* **`src/entities/`**: Core Business Domain. Contains pure fiscal domain constraints.
* **`src/use-cases/`**: Application Logic / Flow Marshals. Orchestrates processing flows, such as `ReadInvoiceUseCase`, managing the sequence from file reading to AI extraction.
* **`src/providers/`**: External Integration Bridges. Houses abstract contracts and concrete implementations for third-party tools. This isolates file storage (`IStorageProvider`) and LLM processing engines (`IAiProvider`), allowing seamless swaps between AI models.
* **`src/repositories/`**: Database Gateways. Handles data access layer operations (CRUD) to manage stock and products.

---

## 🧪 Automated Testing Suite

The application relies heavily on **Automated Unit Testing** to guarantee that core business logic, validation guards, and data pipelines remain flawless before any deployment.

* **Framework**: Built on top of **Vitest**, a next-generation, ultra-fast TypeScript testing engine.
* **Isolation Paradigms**: The testing pipeline adheres to strict SOLID principles by utilizing **Mocks/Stubs** (`MockStorageProvider` and `MockAiProvider`). This isolates the core application under test (SUT) from actual infrastructure liabilities like local hard drive I/O or paid third-party AI network requests.

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