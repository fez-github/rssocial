/**  Routes set up for making RSS/API calls. */

import Router, { RequestHandler } from "express";
import { Call } from "../models/call";
import { Feed } from "../models/feed";
import { userMessage } from "../models/userMessage";
import { BadRequestError } from "../helpers/ExpressError";
import { ICall } from "../types/ICall";
import { ensureLoggedIn } from "../middleware/auth";
import { IMessage, IUserMessage } from "../types/IMessage";
import { IFeed } from "../types/IFeed";
import { Source } from "../models/source";
import Parser from "rss-parser";
import { IRedditPost } from "../types/IReddit";

export const callRouter = Router();

/** Recieves information for creating a call.  Returns a feed created with call info. */
callRouter.post("/new/rss", ensureLoggedIn, async function (req, res, next) {
  try {
    const { id } = res.locals.user;

    const newFeed = await Feed.newFeed(req.body.name, +id, req.body.folder, 1);
    await Call.makeRSSCall(req.body.url, newFeed.id);

    return res.json({ feed: newFeed });
  } catch (e: any) {
    return next(e);
  }
} as RequestHandler);

callRouter.post("/new/reddit", ensureLoggedIn, async function (req, res, next) {
  try {
    const { subreddit, params, sort } = req.body;
    const sourceID = await Source.getSourceID("reddit");
    const { id } = res.locals.user;

    const newFeed = await Feed.newFeed(
      req.body.name,
      +id,
      req.body.folder,
      sourceID.id
    );
    const newCall = await Call.makeRedditCall(
      subreddit,
      newFeed.id,
      params,
      sort
    );

    return res.json({ feed: newFeed });
  } catch (e: any) {
    return next(e);
  }
} as RequestHandler);

callRouter.get("/fetch", ensureLoggedIn, async function (req, res, next) {
  try {
    const { id } = res.locals.user;

    const calls: ICall[] = await Call.getByUserID(id);

    const allMessages: IUserMessage[] = [];
    const promises: Promise<IUserMessage[]>[] = [];

    for (let call of calls) {
      promises.push(runCall(call, id));
    }
    const results = await Promise.all(promises);

    for (let result of results) {
      allMessages.push(...result);
    }

    async function runCall(call: ICall, userID: number) {
      let title;
      let messages: IMessage[] = [];

      if (call.source_name === "rss") {
        const response = await Call.callRSS(call.base_url);
        title = response.title;

        messages = response.items.map((item: Parser.Item) =>
          Call.makeMessage(item)
        );
      } else if (call.source_name === "reddit") {
        if (!call.request_params) call.request_params = "";

        const response = await Call.callReddit(
          call.base_url,
          call.request_params
        );
        title = response.children[0].data.subreddit;
        messages = response.children.map((item) =>
          Call.redditToMessage(item.data)
        );
      }

      if (!call.feed_id) {
        console.log(
          "No feed ID found.  Please update the call in the database."
        );
        return [{}] as IUserMessage[];
      }
      if (!title) {
        console.log("No title found.  Please update the call in the database.");
        return [{}] as IUserMessage[];
      }

      const msgRes = await userMessage.addMessages(messages, title);
      const umsgRes = await userMessage.addUserMessages(
        msgRes,
        id,
        call.feed_id
      );

      return umsgRes;
    }
    return res.json({ messages: allMessages });
  } catch (e: any) {
    return next(e);
  }
} as RequestHandler);

//Making RSS Call.
callRouter.post("/rss", async function (req, res, next) {
  try {
    const { rssURL } = req.body;
    const rssFeed = await Call.callRSS(rssURL);

    return res.status(201).json({ feed: rssFeed });
  } catch (err) {
    return next(err);
  }
} as RequestHandler);
