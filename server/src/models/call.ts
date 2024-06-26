/** Class that holds methods for making API/RSS calls. */
import { IMessage } from "../types/IMessage";
import { Item, Output } from "rss-parser";
import Parser from "rss-parser";
import { db } from "../db";
import { QueryResult } from "pg";
import { ICall } from "../types/ICall";
import { IRedditPost, IRedditResponse } from "../types/IReddit";
import { IParams, convertParamsToString } from "../helpers/params";
import axios, { AxiosRequestHeaders } from "axios";
import { BadRequestError } from "../helpers/ExpressError";

export class Call {
  /** Receives a URL and calls it. */
  static async callRSS(url: string) {
    try {
      const parser = new Parser();
      const xml: Output<Item> = await parser.parseURL(url);

      const messages = xml.items.map((item) => this.makeMessage(item));

      return xml;
    } catch (e: any) {
      throw new BadRequestError("Invalid URL");
    }
  }

  static async callReddit(url: string, params: string) {
    const response = await axios.get<IRedditResponse>(url, { params });
    return response.data.data;
  }

  /** Convert RSS messages into IMessage for storage.
   *  Checks for any missing fields when needed.
   */
  static makeMessage(message: ItemEx) {
    const newMessage = {} as IMessage;

    if (message.creator) {
      newMessage.author = message.creator;
    } else {
      newMessage.author = "No author.";
    }

    if (message.title) {
      newMessage.title = message.title;
    } else {
      newMessage.title = "No title.";
    }

    if (message.pubDate) {
      newMessage.date_created = new Date(message.pubDate);
    } else {
      newMessage.date_created = new Date();
    }

    if (message.guid) {
      if (!isNaN(+message.guid)) {
        //guid has occasionally been the news article's internal ID instead of a link.  Check for this.
        if (message.link) {
          newMessage.source_link = message.link;
        }
      } else {
        newMessage.source_link = message.guid;
      }
    } else {
      newMessage.source_link = "";
    }

    if (message["content:encoded"]) {
      newMessage.content = message["content:encoded"];
    } else if (message.content) {
      newMessage.content = message.content;
    } else {
      newMessage.content = null;
    }

    if (message["content:encodedSnippet"]) {
      newMessage.description = message["content:encodedSnippet"];
    } else if (message.contentSnippet) {
      newMessage.description = message.contentSnippet;
    }

    return newMessage;
  }

  static redditToMessage(redditMsg: IRedditPost) {
    const newMessage = {} as IMessage;

    newMessage.author = redditMsg.author;
    newMessage.title = redditMsg.title;
    newMessage.date_created = new Date(redditMsg.created_utc * 1000);
    newMessage.source_link = `https://reddit.com${redditMsg.permalink}`;
    newMessage.content = redditMsg.selftext_html;
    newMessage.description = "";

    //Reddit selftext contains comments that interfere with embedding.  Removing them now.
    if (newMessage.content) {
      const regex = new RegExp("&lt;!-- SC_OFF --&gt;", "g");
      newMessage.content = newMessage.content.replace(regex, "");
    }

    return newMessage;
  }

  /** Use info received from front-end to create calls tailored to RSS feeds. */
  static makeRSSCall(url: string, feedID: number) {
    //Test if URL is a valid RSS URL.
    try {
      const parser = new Parser();
      const xml = parser.parseURL(url);
    } catch (e: any) {
      throw new BadRequestError(e);
    }

    return this.newCall(url, feedID);
  }

  static async newCall(
    url: string,
    feedID: number,
    body: string | null = null,
    params: string | null = null,
    headers: string | null = null
  ) {
    const query: QueryResult<ICall> = await db.query(
      `INSERT INTO calls (base_url, feed_id, request_body, request_params, request_headers)
        VALUES($1,$2,$3,$4,$5)
        RETURNING *`,
      [url, feedID, body, params, headers]
    );

    return query.rows[0];
  }

  static async getByUserID(userID: number) {
    //Also returns info to help later on.
    const query: QueryResult<ICall> = await db.query(
      `SELECT c.id, feed_id, s.name AS source_name, base_url, request_body, request_params, request_headers
      FROM calls c
      JOIN feeds f ON f.id = c.feed_id
      JOIN sources s ON s.id = f.source_id
      WHERE f.user_id=$1`,
      [userID]
    );
    return query.rows;
  }

  static async makeRedditCall(
    subreddit: string,
    feedID: number,
    paramBody: IParams = {} as IParams,
    sort: string
  ) {
    const url = `https://www.reddit.com/r/${subreddit}/${sort}.json`;

    if (!process.env.reddit_token || !process.env.reddit_useragent)
      throw new BadRequestError("Reddit environment variables not set.");

    const params = convertParamsToString(paramBody);
    //Check if call can be made.

    try {
      const response = await axios.get(url, { params });
    } catch (e: any) {
      throw new BadRequestError(e);
    }

    return this.newCall(url, feedID, null, params, null);
  }
}

interface ItemEx extends Item {
  "content:encoded"?: string;
  "content:encodedSnippet"?: string;
}
