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
	@echo "1. Gear icon -> 'Use your own OAuth credentials' -> paste CHROME_CLIENT_ID / CHROME_CLIENT_SECRET from .env"
	@echo "2. Step 1 scope: https://www.googleapis.com/auth/chromewebstore -> Authorize APIs"
	@echo "3. Step 2: 'Exchange authorization code for tokens'"
	@echo "4. Copy refresh_token into .env as CHROME_REFRESH_TOKEN (and update the GitHub secret)"
	open "https://developers.google.com/oauthplayground/"

chrome_refresh:
	curl -s "https://oauth2.googleapis.com/token" -d \
    "client_id=${CHROME_CLIENT_ID}&client_secret=${CHROME_CLIENT_SECRET}&grant_type=refresh_token&refresh_token=${CHROME_REFRESH_TOKEN}"

chrome_status:
	../go-webext/go-webext status chrome -a $(CHROME_APP_ID)

chrome_update:
	../go-webext/go-webext update chrome -a $(CHROME_APP_ID) -f ./build/release/chrome.zip
