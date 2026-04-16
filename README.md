# FieldWatch

Field reporting platform for inspectors, maintenance crews, and technicians.

[![Backend CI](https://github.com/your-org/fieldwatch/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/your-org/fieldwatch/actions/workflows/backend-ci.yml)
[![Mobile CI](https://github.com/your-org/fieldwatch/actions/workflows/mobile-ci.yml/badge.svg)](https://github.com/your-org/fieldwatch/actions/workflows/mobile-ci.yml)
[![Deploy](https://github.com/your-org/fieldwatch/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-org/fieldwatch/actions/workflows/deploy.yml)

## Quick Start

```bash
make up        # Start all services (FastAPI, PostgreSQL+PostGIS, Redis, Celery)
make migrate   # Run Alembic migrations
make seed      # Seed test data
make test      # Run all tests
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile | React Native + Expo (TypeScript) |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 async |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Task Queue | Celery + Redis |
| File Storage | AWS S3 |
| Auth | JWT access + refresh token rotation |
| Push Notifications | Firebase Cloud Messaging (FCM) |

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. Required variables:

```
DATABASE_URL=postgresql+asyncpg://fieldwatch:fieldwatch@db:5432/fieldwatch
REDIS_URL=redis://redis:6379/0
JWT_SECRET=change-me-in-production
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=fieldwatch-uploads
AWS_REGION=eu-north-1
FIREBASE_CREDENTIALS_JSON={}
```

## Makefile Reference

| Command | Description |
|---------|-------------|
| `make up` | Start all Docker services |
| `make down` | Stop all Docker services |
| `make logs` | Tail service logs |
| `make test` | Run backend + mobile tests |
| `make test-backend` | pytest with coverage |
| `make test-mobile` | Jest tests |
| `make lint` | Ruff + ESLint |
| `make typecheck` | mypy + tsc |
| `make migrate` | Run Alembic migrations |
| `make seed` | Seed database with test data |
