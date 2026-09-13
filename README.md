# AppMessaging - Real-Time Communication Platform

> **Fullstack AI Agent Governance Enabled Project**  
> Built with Next.js (App Router), React, Tailwind CSS, TypeScript, and Node.js.

---

## 🏗️ Architecture & Standards

Dự án tuân thủ tiêu chuẩn AI Governance theo hệ sinh thái Antigravity IDE (`.agent/`) và Claude Code (`.claude/`):

- **Atomic Design (Frontend)**: `src/components/atoms/`, `src/components/molecules/`, `src/components/organisms/`.
- **4 Mandatory UI States**: Loading (Skeleton), Empty, Error (Retry), Success.
- **Layered Architecture (Backend)**: Controller -> Service -> Repository.
- **Zero-Trust Validation**: Sử dụng Zod schemas cho toàn bộ input/output boundaries.
- **Token Economy**: Tuân thủ triệt để `rules/token-economy.md`.

---

## 🚀 Quick Start

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Thiết lập biến môi trường
```bash
cp .env.example .env.local
```

### 3. Cài đặt Agent Skills mở rộng (tùy chọn)
- Trên Windows PowerShell:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\install-skills.ps1
  ```
- Trên Linux/macOS:
  ```bash
  bash scripts/install-skills.sh
  ```

### 4. Chạy môi trường phát triển (Development)
```bash
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:3000`

---

## ⚡ Scripts Cheat-Sheet

```bash
npm run dev          # Chạy Next.js development server
npm run build        # Build production bundle
npm run start        # Chạy server production
npm run lint         # Linter check
npm run type-check   # Kiểm tra type tĩnh (tsc --noEmit)
npm test             # Chạy unit/integration tests
```
