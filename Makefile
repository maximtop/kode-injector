# Local builds never upload, submit, or publish. See DEVELOPMENT.md for outputs.
.DEFAULT_GOAL := build
override BROWSERS := chrome edge firefox safari
override BROWSER_GOALS := $(filter $(BROWSERS),$(MAKECMDGOALS))
override BUILD_GOALS := $(filter build dev start release package,$(MAKECMDGOALS))
override COMMAND_GOALS := install setup init build dev start release package lint typecheck test check validate native_test native_package chrome_status chrome_update chrome_publish .require-chrome-app-id
override UNKNOWN_GOALS := $(filter-out $(COMMAND_GOALS) $(BROWSERS),$(MAKECMDGOALS))
ifneq ($(UNKNOWN_GOALS),)
  $(error Unknown command or unsupported browser: $(UNKNOWN_GOALS). Supported browsers: $(BROWSERS))
endif
ifneq ($(word 2,$(BROWSER_GOALS)),)
  $(error Choose at most one browser: $(BROWSERS))
endif
ifneq ($(BROWSER_GOALS),)
  ifneq ($(words $(BUILD_GOALS)),1)
    $(error A browser requires exactly one build command: build, dev, start, release or package)
  endif
endif
override BROWSER_TARGET := $(firstword $(BROWSER_GOALS))

.PHONY: $(COMMAND_GOALS) $(BROWSERS)

install setup init:
	pnpm install

build dev:
	pnpm build $(BROWSER_TARGET)

start:
	pnpm start $(BROWSER_TARGET)

release package:
	pnpm release $(BROWSER_TARGET)

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

check validate:
	pnpm check

$(BROWSERS):
	@:

native_test:
	pnpm native:test

native_package:
	pnpm native:package

# Local Chrome Web Store fallback for .github/workflows/deploy-chrome-store.yml.
# Credentials come either from the environment (op run --env-file=.env.1password,
# see 1password.env.example) or from the gitignored .env that go-webext loads
# itself (see .env.example). CHROME_APP_ID is taken from the environment when
# set and read from .env otherwise. Edge and Firefox commands are documented in
# docs/RELEASE.md.
export CHROME_API_VERSION := v2
CHROME_APP_ID ?= $(strip $(shell \
  sed -nE 's/^[[:space:]]*(export[[:space:]]+)?CHROME_APP_ID[[:space:]]*=[[:space:]]*//p' \
    .env 2>/dev/null \
  | tail -n 1 \
  | sed -E 's/[[:space:]]+\#.*$$//' \
  | tr -d "\"'\r"))

.require-chrome-app-id:
	@test -n "$(CHROME_APP_ID)" || { echo "CHROME_APP_ID is empty; fill in .env (see .env.example)" >&2; exit 1; }

chrome_status: .require-chrome-app-id
	@go-webext status chrome -a "$(CHROME_APP_ID)"

# A fresh build guarantees that the uploaded manifest carries the package.json
# version.
chrome_update: .require-chrome-app-id
	@pnpm release chrome
	@go-webext update chrome -a "$(CHROME_APP_ID)" -f "build/release/chrome.zip"

chrome_publish: .require-chrome-app-id
	@go-webext publish chrome -a "$(CHROME_APP_ID)" --staged
