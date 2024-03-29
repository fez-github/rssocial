export interface IMessage {
  messageID: number;
  feedID?: number;
  author: string;
  title: string;
  content: string;
  description: string;
  date_created: Date;
  source_link: string;
  thumbnail?: string;
  unread?: boolean;
  // message_id SERIAL NOT NULL,
  // feed_id VARCHAR NOT NULL
  //   REFERENCES feeds ON DELETE NULL
  // source_name TEXT NOT NULL,
  // author TEXT NOT NULL,
  // title TEXT NOT NULL,
  // content TEXT NOT NULL,
  // date_created DATE NOT NULL,
  // source_link TEXT NOT NULL,
  // unread BOOLEAN DEFAULT TRUE
}

export interface IUserMessage {
  id: number;
  notes: string;
  clicks: number;
  react_id: number | null;
  feed_id: number;
  bookmark_id: number | null;
  source_name: string,
  author: string;
  seen: boolean;
  title: string;
  content: string;
  description: string,
  date_created: string; //ISO date string
  source_link: string;
}