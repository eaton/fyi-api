import { FBMedia } from '../facebook/index.js';

export type InstagramProfileChunk = {
  title: string;
  media_map_data: Record<string, unknown>;
  string_map_data: Record<string, InstagramProfileValue>;
};

export type InstagramProfileValue = {
  href: string;
  value: string;
  timestamp: number;
};

export type InstagramPost = {
  title?: string;
  creation_timestamp: number;
  media: FBMedia[];
};

export type IGCachedPost = {
  id: string;
  title?: string;
  date?: string;
  media: {
    url: string;
    date: string | number;
    title?: string;
    exif?: Record<string, unknown>;
  }[];
};
