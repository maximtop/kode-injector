.PHONY: build dev release chrome edge firefox native_test native_package

include .env

BROWSERS := chrome edge firefox
BROWSER_TARGET := $(firstword $(filter $(BROWSERS),$(MAKECMDGOALS)))

install:
	pnpm install

start:
	pnpm dev chrome --watch

build:
	pnpm release $(BROWSER_TARGET)

dev:
	pnpm dev $(BROWSER_TARGET)

release:
	pnpm release $(BROWSER_TARGET)

chrome edge firefox:
	@:

lint:
	pnpm lint
	pnpm typecheck

typecheck:
	pnpm typecheck

test:
	pnpm test

validate:
	pnpm validate

native_test:
	pnpm native:test

native_package:
	pnpm native:package

chrome_status:
	../go-webext/go-webext status chrome -a $(CHROME_APP_ID)

chrome_update:
	../go-webext/go-webext update chrome -a $(CHROME_APP_ID) -f ./build/release/chrome.zip
