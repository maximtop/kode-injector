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

chrome_code:
	open "https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=${CHROME_CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob"

chrome_refresh:
	curl "https://accounts.google.com/o/oauth2/token" -d \
    "client_id=${CHROME_CLIENT_ID}&client_secret=${CHROME_CLIENT_SECRET}&code=${CHROME_CODE}&grant_type=authorization_code&redirect_uri=urn:ietf:wg:oauth:2.0:oob"

chrome_status:
	../go-webext/go-webext status chrome -a $(CHROME_APP_ID)

chrome_update:
	../go-webext/go-webext update chrome -a $(CHROME_APP_ID) -f ./build/release/chrome.zip
