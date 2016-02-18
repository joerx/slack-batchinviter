Stupid tool to batch-invite people into a private Slack channel by name. Used to 
batch-invite speakers at FOSSASIA 2016 into the speakers channel.

Usage:

- place a file called `invitees.txt` in the same directory as `index.js`
- set `SLACK_API_TOKEN` environment variable to a valid token
- call the script with `node index.js channel_name`
