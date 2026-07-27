.PHONY: build dev release chrome edge firefox native_test native_package \
	chrome_status chrome_update edge_update edge_publish firefox_status \
	firefox_update

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

# Let go-webext parse Edge credentials from `.env` itself so dotenv quoting and
# special characters are preserved instead of being reinterpreted by make.
export FIREFOX_CLIENT_ID FIREFOX_CLIENT_SECRET

edge_update:
	EDGE_API_VERSION=v1.1 ../go-webext/go-webext update edge -a $(EDGE_PRODUCT_ID) -f ./build/release/edge.zip

edge_publish:
	EDGE_API_VERSION=v1.1 ../go-webext/go-webext publish edge -a $(EDGE_PRODUCT_ID)

firefox_status:
	../go-webext/go-webext status firefox -a $(FIREFOX_APP_ID)

firefox_update:
	../go-webext/go-webext update firefox -f ./build/release/firefox.zip -s ./build/release/source.zip -c listed -n "$$(cat ./build/release/approval-notes.txt)"
