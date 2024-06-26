import { QueryResult } from "pg";
import { db } from "../db";
import { IFeed } from "../types/IFeed";

export class Feed {
  /** Get a feed by it's ID. */
  static async getFeed(feedID: number): Promise<IFeed> {
    const query: QueryResult<IFeed> = await db.query(
      `SELECT * FROM feeds
      WHERE id=$1`,
      [feedID]
    );
    return query.rows[0];
  }

  static async newFeed(
    feedName: string,
    userID: number,
    folderID: number,
    sourceID: number
  ): Promise<IFeed> {
    //Store feed into Feeds table.
    const query: QueryResult<IFeed> = await db.query(
      `INSERT INTO feeds (user_id, folder_id, source_id, feed_name)
      VALUES($1,$2,$3,$4)
      RETURNING *`,
      [userID, folderID, sourceID, feedName]
    );

    const feedID = query.rows[0].id;

    //Use Feed info to get additional data from database.
    const query2: QueryResult<IFeed> = await db.query(
      `SELECT f.id, f.user_id, f.folder_id, s.name AS source_name, 
      s.img AS source_img, feed_name
      FROM feeds f
      JOIN sources s ON f.source_id = s.id
      WHERE f.id=$1`,
      [feedID]
    );

    return query2.rows[0];
  }

  static async getFeedsByFolderID(folderID: number): Promise<IFeed[]> {
    const query: QueryResult<IFeed> = await db.query(
      `SELECT f.id, f.user_id, f.folder_id, s.name AS source_name, 
      s.img AS source_img, feed_name, c.id AS call_id
      FROM feeds f
      JOIN sources s ON f.source_id = s.id
      JOIN calls c ON f.id = c.feed_id
      WHERE folder_id=$1`,
      [folderID]
    );
    return query.rows;
  }

  static async getFeedsByUser(userID: number): Promise<IFeed[]> {
    const query: QueryResult<IFeed> = await db.query(
      `SELECT f.id, f.user_id, f.folder_id, s.name AS source_name, 
      s.img AS source_img, feed_name
      FROM feeds f
      JOIN sources s ON f.source_id = s.id
      WHERE user_id=$1`,
      [userID]
    );
    return query.rows;
  }

  static async deleteFeed(feedID: number): Promise<IFeed> {
    const query: QueryResult<IFeed> = await db.query(
      `DELETE FROM feeds
       WHERE id=$1
       RETURNING *`,
      [feedID]
    );

    return query.rows[0];
  }
}
