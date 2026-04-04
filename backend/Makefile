# Backend build — plain Node.js (no transpile). Docker build needs repo root as context.
BACKEND_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
REPO_ROOT := $(abspath $(BACKEND_DIR)/..)
IMAGE_NAME ?= ecommerce-backend
IMAGE_TAG ?= latest

.PHONY: help install build clean docker-build

help:
	@echo "Targets:"
	@echo "  make install      — npm ci (dev + prod dependencies)"
	@echo "  make build        — npm ci --omit=dev (production install; use in CI or before deploy)"
	@echo "  make docker-build — docker image ($(IMAGE_NAME):$(IMAGE_TAG)); context = repo root"
	@echo "  make clean        — remove node_modules (optional reset)"

install:
	cd $(BACKEND_DIR) && npm ci

build:
	cd $(BACKEND_DIR) && npm ci --omit=dev

clean:
	rm -rf $(BACKEND_DIR)node_modules

docker-build:
	docker build -f $(BACKEND_DIR)Dockerfile -t $(IMAGE_NAME):$(IMAGE_TAG) $(REPO_ROOT)
