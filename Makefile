PNPM ?= pnpm
PYTHON ?= python3

.PHONY: bootstrap start-all build test verify

bootstrap:
	@$(PNPM) install --frozen-lockfile

start-all:
	@$(PNPM) dev

build:
	@$(PNPM) build

test:
	@$(PYTHON) scripts/test_source_offer.py
	@$(PNPM) test

verify: test build
