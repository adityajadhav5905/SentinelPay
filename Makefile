.PHONY: build up down logs restart deploy push-env

build:
	docker compose -f docker-compose.prod.yml build

up:
	docker compose -f docker-compose.prod.yml up -d

down:
	docker compose -f docker-compose.prod.yml down

logs:
	docker compose -f docker-compose.prod.yml logs -f

restart:
	docker compose -f docker-compose.prod.yml restart

deploy:
	bash scripts/deploy.sh

push-env:
	scp -i $(KEY) .env.production $(USER)@$(HOST):/app/Anomalyze/.env.production
	scp -i $(KEY) frontend/.env.production $(USER)@$(HOST):/app/Anomalyze/frontend/.env.production
