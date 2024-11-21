import dotenv from "dotenv";
import {App} from "octokit";
import {createNodeMiddleware} from "@octokit/webhooks";
import fs from "fs";
import http from "http";

// reads .env and adds variables to the process.env object in Node.js
dotenv.config();

const appId = process.env.APP_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const privateKeyPath = process.env.PRIVATE_KEY_PATH;

const privateKey = fs.readFileSync(privateKeyPath, "utf8");

const app = new App({
    appId: appId,
    privateKey: privateKey,
    webhooks: {
      secret: webhookSecret
    },
});

const messageForNewPRs = "Thanks for opening a new PR! Please follow our contributing guidelines to make your PR easier to review.";

async function handlePullRequestOpened({octokit, payload}) {
    console.log(`Received a pull request event for #${payload.pull_request.number}`);
    try {
      await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.pull_request.number,
        body: messageForNewPRs,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      });
    } catch (error) {
      if (error.response) {
        console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
      }
      console.error(error)
    }
};

// Sets up a webhook event listener
// When app receives a webhook event from github with a X-Github-Event header value
// of "pull_request" and an action payload value of "opened" it calls handlePullRequestOpened
app.webhooks.on("pull_request.opened", handlePullRequestOpened);

app.webhooks.onError((error) => {
    if (error.name === "AggregateError") {
      console.error(`Error processing request: ${error.event}`);
    } else {
      console.error(error);
    }
});

const port = 3000;
const host = 'localhost';
const path = "/api/webhook";
const localWebhookUrl = `http://${host}:${port}${path}`;

// Middleware function will do the following
// Check the signature of incoming webhook event to make sure it matches webhook secret
// Parse webhook event payload and identify the type of event
// Trigger the corresponding webhook event handler
const middleware = createNodeMiddleware(app.webhooks, {path});

// Cretes Node.js server that listens for incoming HTTP requests on specified port
// When server receieves a request it executes the middleware function
http.createServer(middleware).listen(port, () => {
    console.log(`Server is listening for events at: ${localWebhookUrl}`);
    console.log('Press Ctrl + C to quit.')
});
