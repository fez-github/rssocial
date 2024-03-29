/** Class pertaining to user objects. */
import bcrypt from "bcrypt";
import { BCRYPT_WORK_FACTOR } from "../config";
import { db } from "../db";
import { UnauthorizedError } from "../helpers/ExpressError";
import { BadRequestError } from "../helpers/ExpressError";

import { IUser } from "../types/IUser";
import { IReaction } from "../types/IReaction";
import { sendVerifyEmail } from "../helpers/email";
import { QueryResult } from "pg";
import { Folder } from "./folder";
import { Feed } from "./feed";
import { userMessage } from "./userMessage";
import { Reaction } from "./reaction";
import { Source } from "./source";
import { Bookmark } from "./bookmark";
import { INews } from "../types/INews";

export class User {

  /** Check if credentials match a user. */
  static async authenticate(username: string, password: string): Promise<IUser> {
    // try to find the user first
    const result: QueryResult<IUser> = await db.query(
      `SELECT *
              FROM users
              WHERE username = $1`,
      [username]
    );

    const user = result.rows[0];

    if (user) {
      // compare hashed password to a new hash from password
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid === true) {
        user.password = ""
        return user;
      }
    }

    throw new UnauthorizedError("Incorrect username/password");
  }

  static async register({ username, password, email }: IUser) {
    const duplicateCheck: QueryResult<{ username: string }> = await db.query(
      `SELECT username
         FROM users
         WHERE username = $1`,
      [username]
    );

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate username: ${username}`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    const result = await db.query(
      `INSERT INTO users
         (username,
          password,
          email)
         VALUES ($1, $2, $3)
         RETURNING id, username, email`,
      [username, hashedPassword, email]
    );

    const user: IUser = result.rows[0];

    //Create a token for verification, then email it to user.
    await sendVerifyEmail(user.username, user.email, user.id)

    return user;
  }

  /** Verify user. */
  static async verify(userID: number): Promise<IUser> {
    const result = await db.query(
      `UPDATE users
       SET verified=true
       WHERE id=$1
       RETURNING id,username,email,profile_img,bio`
      , [userID]
    )

    return result.rows[0]
  }

  /** Return all users.(is this even useful for this project?) */
  static async getAll(): Promise<IUser[]> {
    const result: QueryResult<IUser> = await db.query(
      `SELECT   id,
                username,
                email
               FROM users
               ORDER BY username`
    );

    return result.rows;
  }

  /** Return specific user. */
  static async get(username: string): Promise<IUser> {
    const userRes: QueryResult<IUser> = await db.query(
      `SELECT id, username, email, profile_img, bio, verified
           FROM users
           WHERE username = $1`,
      [username]
    );

    const user = userRes.rows[0];
    return user;
  }

  /** Return all reactions user has made. */
  static async getReactions(user_id: number): Promise<IReaction[]> {
    const query: QueryResult<IReaction> = await db.query(
      `SELECT r.id, r.name, r.img
        FROM users u
          JOIN user_messages um ON u.id = um.user_id
          JOIN reactions r ON um.react_id = r.id
        WHERE u.id=$1
        `,
      [user_id]
    );
    return query.rows;
  }

  /** Return full object of all user folders, feeds and messages. */
  static async getUserMessagesNested(userID: number) {
    let requests = await Promise.all([
      db.query(`SELECT f.id, f.folder_id, s.name AS source_name, s.img AS source_img, feed_name 
              FROM feeds f 
              JOIN sources s ON f.source_id = s.id
              WHERE user_id=$1`, [userID]),
      db.query(`SELECT * FROM folders WHERE user_id=$1`, [userID]),
    ]);

    const feeds = requests[0].rows;
    const folders = requests[1].rows;

    let promises = [];

    //Attach feeds to their corresponding folders.
    //Each instance of a feed is put into a Promise array, so all calls are done at once.
    for (let feed of feeds) {
      if (!folders[feed.folder_id - 1].feeds) {
        folders[feed.folder_id - 1].feeds = []
      }

      folders[feed.folder_id - 1].feeds.push(feed);
      promises.push((feed.messages = await userMessage.getMessagesByFeed(feed.id)));
    }

    await Promise.all([promises]);

    return folders;
  }

  static async getUserMessages(userID: number): Promise<INews> {
    // let requests = await Promise.all([
    //   db.query(`SELECT * FROM folders 
    //         WHERE user_id=$1`, [userID]),
    //   db.query(`SELECT f.id, f.folder_id, s.name AS source_name, s.img AS source_img, feed_name 
    //         FROM feeds f 
    //         JOIN sources s ON f.source_id = s.id
    //         WHERE user_id=$1`, [userID]),
    //   db.query(`SELECT 
    //   m.id, feed_id, notes, clicks, react_id, feed_id, bookmark_id,
    //   seen, source_name, author, title, content, date_created, source_link
    // FROM user_messages um 
    // JOIN messages m ON um.message_id = m.id
    // WHERE user_id=$1
    // ORDER BY SEEN ASC, date_created DESC`, [userID]),
    //   db.query(`SELECT * FROM reactions`),
    //   db.query(`SELECT * FROM sources`),
    //   db.query(`SELECT * FROM bookmarks WHERE user_id=$1`, [userID]),
    // ]);

    // const masterFeeds = {
    //   folders: requests[0].rows,
    //   feeds: requests[1].rows,
    //   messages: requests[2].rows,
    //   reactions: requests[3].rows,
    //   sources: requests[4].rows,
    //   bookmarks: requests[5].rows
    // }

    // return masterFeeds

    const requests = await Promise.all([
      Folder.getFoldersByUser(userID),
      Feed.getFeedsByUser(userID),
      userMessage.getMessagesByUser(userID),
      Reaction.getReactions(),
      Source.getAll(),
      Bookmark.getBookmarksByUser(userID)
    ])

    return {
      folders: requests[0],
      feeds: requests[1],
      messages: requests[2],
      reactions: requests[3],
      sources: requests[4],
      bookmarks: requests[5]
    }
  }

  static async getMetrics(userID: number) {
    const promises = await Promise.all([
      db.query(`SELECT f.feed_name AS feed_name, SUM(clicks) AS feed_clicks
     FROM user_messages um
     JOIN feeds f ON f.id = um.feed_id
     WHERE um.user_id=$1
     GROUP BY GROUPING SETS (f.feed_name, ())
     ORDER BY f.feed_name NULLS LAST`, [userID]),
      db.query(`SELECT f.feed_name AS feed_name, r.name AS react_name, SUM(r.id) AS sum_reactions
     FROM user_messages um
     JOIN feeds f ON f.id = um.feed_id
     JOIN reactions r ON r.id = um.react_id
     WHERE um.user_id=$1
     GROUP BY f.feed_name, r.name`, [userID]),
      db.query(`SELECT COUNT(seen) AS seen_messages
     FROM user_messages
     WHERE seen=true AND user_id=$1
     GROUP BY user_id;`, [userID])
    ])

    const allFeeds = {
      clicks: promises[0].rows,
      reactions: promises[1].rows,
      messages: promises[2].rows
    }

    return allFeeds
  }
}

