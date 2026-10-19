# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0

# Chạy được từ bất kỳ thư mục nào: make -f /đường/dẫn/Makefile up
ROOT    := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
COMPOSE := docker compose --env-file $(ROOT).env -f $(ROOT)infra/compose/docker-compose.yml

.PHONY: help up down reset ps logs config release

help:
	@echo "make up       - dựng Tầng 1 (cần .env, sao chép từ .env.example)"
	@echo "make down     - dừng, giữ dữ liệu"
	@echo "make reset    - dừng, xóa dữ liệu và dựng lại từ đầu"
	@echo "make ps       - trạng thái các dịch vụ"
	@echo "make logs     - xem nhật ký (SERVICE=tên-dịch-vụ để lọc)"
	@echo "make release VERSION=x.y.z - tạo gói .tar.gz bằng git archive"

$(ROOT).env:
	@echo "Thiếu .env. Chạy: cp .env.example .env" && exit 1

up: $(ROOT).env
	sh $(ROOT)scripts/init.sh $(ROOT)
	$(COMPOSE) up -d --wait
	sh $(ROOT)scripts/sync-jwks.sh $(ROOT)

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
