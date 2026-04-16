.PHONY: up down logs test-backend test-mobile lint-backend lint-mobile typecheck migrate seed test lint

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

test-backend:
	docker-compose exec backend pytest -v --cov=app --cov-report=term-missing

test-mobile:
	cd packages/mobile && npx jest

lint-backend:
	docker-compose exec backend ruff check .

lint-mobile:
	cd packages/mobile && npx eslint src/

typecheck:
	docker-compose exec backend mypy app/ && cd packages/mobile && npx tsc --noEmit

migrate:
	docker-compose exec backend alembic upgrade head

seed:
	docker-compose exec backend python scripts/seed.py

test: test-backend test-mobile

lint: lint-backend lint-mobile
