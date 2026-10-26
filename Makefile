# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0

# Chạy được từ bất kỳ thư mục nào: make -f /đường/dẫn/Makefile up
ROOT    := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
COMPOSE := docker compose --env-file $(ROOT).env -f $(ROOT)infra/compose/docker-compose.yml

.PHONY: help up down reset ps logs config release migrate test test-stack n8n-reload

help:
	@echo "make up       - dựng Tầng 1 và web/API (cần .env)"
	@echo "make down     - dừng, giữ dữ liệu"
	@echo "make reset    - dừng, xóa dữ liệu và dựng lại từ đầu"
	@echo "make ps       - trạng thái các dịch vụ"
	@echo "make logs     - xem nhật ký (SERVICE=tên-dịch-vụ để lọc)"
	@echo "make release VERSION=x.y.z - tạo gói .tar.gz bằng git archive"
	@echo "make migrate  - áp dụng migration mới, giữ dữ liệu"
	@echo "make test     - build và kiểm thử API/web"
	@echo "make test-stack - kiểm chứng Keycloak/APISIX/API/PostgREST/n8n thật"

$(ROOT).env:
	@echo "Thiếu .env. Chạy: cp .env.example .env" && exit 1

up: $(ROOT).env
	sh $(ROOT)scripts/init.sh $(ROOT)
	$(COMPOSE) up -d --wait postgres keycloak
	$(MAKE) -f $(ROOT)Makefile migrate
	sh $(ROOT)scripts/sync-jwks.sh $(ROOT)
	$(COMPOSE) up -d --build --wait

migrate: $(ROOT).env
	$(COMPOSE) exec -T postgres sh /docker-entrypoint-initdb.d/02-migrations.sh

test:
	npm --prefix $(ROOT)apps/api ci
	npm --prefix $(ROOT)apps/api test
	npm --prefix $(ROOT)apps/web ci
	npm --prefix $(ROOT)apps/web run build
	npm --prefix $(ROOT)apps/web test

test-stack: $(ROOT).env
	node $(ROOT)scripts/stack-test.mjs

n8n-reload: $(ROOT).env
	$(COMPOSE) stop n8n
	$(COMPOSE) run --rm --no-deps n8n-import
	$(COMPOSE) run --rm --no-deps n8n-publish
	$(COMPOSE) up -d --wait n8n

down: $(ROOT).env
	$(COMPOSE) down

reset: $(ROOT).env
	$(COMPOSE) down -v --remove-orphans
	rm -f $(ROOT)infra/seaweedfs/s3.json $(ROOT)infra/postgrest/jwks.json
	$(MAKE) -f $(ROOT)Makefile up

ps: $(ROOT).env
	$(COMPOSE) ps

logs: $(ROOT).env
	$(COMPOSE) logs -f --tail=100 $(SERVICE)

config: $(ROOT).env
	$(COMPOSE) config -q

release:
	@test -n "$(VERSION)" || (echo "Dùng: make release VERSION=0.1.0" && exit 1)
	git -C $(ROOT) archive --format=tar.gz --prefix=dx-desk-$(VERSION)/ -o $(ROOT)dx-desk-$(VERSION).tar.gz v$(VERSION)
	@echo "Đã tạo dx-desk-$(VERSION).tar.gz"
