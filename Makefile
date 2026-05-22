.PHONY: help install setup dev dashboard doctor test eval build verify clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

setup: ## Install skill and start local runtime
	./bin/cognibrain.mjs setup

dev: ## Run the TypeScript API server
	npm run dev

dashboard: ## Run the React dashboard
	npm run dashboard

doctor: ## Check runtime and package readiness
	./bin/cognibrain.mjs doctor --publish

test: ## Run TypeScript tests
	npm run test

eval: ## Run the self-verification benchmark
	npm run eval

build: ## Build TypeScript and dashboard
	npm run build

verify: ## Run tests, benchmark, and build
	npm run verify

clean: ## Remove generated artifacts
	./bin/cognibrain.mjs clean
