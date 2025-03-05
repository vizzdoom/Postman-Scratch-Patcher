# Postman-Scratch-Patcher

This npm script changes behaviour of Postman application to be used *locally (without online services)* in following way:
- sets environment to work on scratchpad with collections (even when Postman is in the "Lighweight API Client mode")
- disables "ScratchPad is obsolete" pop-ups
- disables yellow top bar informing that you are "Working locally in Scratch pad. Switch to WORKSPLACE"

*REMARK: Your local Scratch Pad collections **will be removed** after executing this script (at least for now)*

## Requirements
- *Windows* (this script do not work on Linux at this moment)
- nodejs (in the PATH)
- asar (in the PATH, you can install this using: npm install -g asar)
- Postman installed and run at least once

## How-to
`npm install -g asar`

`node postman-scratchpatcher.js`

### After executing you *will see* the following:
![Postman Scratchpad Mode](docs/postman-scratchpad-mode.png)

### After executing you *will not see* the following:
![Scratch Pad is being discontinued sign up to continue using collections](docs/Scratch-Pad-is-being-discontinued-sign-up-to-continue-using-collections.png)

![Unlock Postman with an account](docs/Unlock-Postman-with-an-account.png)

![Lightweight API Client](docs/Lightweight-API-Client.png)

![Scratchpad Info Bar](docs/scratchpad-info-bar.png)
