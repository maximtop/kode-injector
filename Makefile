.PHONY: build

include .env

install:
	yarn install

start:
	yarn start

build:
	yarn build

lint:
	yarn lint

chrome_code:
	open "https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=${CHROME_CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob"


chrome_refresh:
	curl "https://accounts.google.com/o/oauth2/token" -d \
    "client_id=${CHROME_CLIENT_ID}&client_secret=${CHROME_CLIENT_SECRET}&code=${CHROME_CODE}&grant_type=authorization_code&redirect_uri=urn:ietf:wg:oauth:2.0:oob"

chrome_status:
	../go-webext/go-webext status chrome -a $(CHROME_APP_ID)
