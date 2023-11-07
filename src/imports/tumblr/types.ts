export type TumblrUser = {
  user: {
    name: string;
    likes: number;
    following: number;
    default_post_format: string;
    blogs: TumblrBlog[];
  };
};

export type TumblrBlog = {
  admin: boolean;
  ask: boolean;
  ask_anon: boolean;
  ask_page_title: string;
  asks_allow_media: boolean;
  avatar: unknown;
  can_chat: boolean;
  can_send_fan_mail: boolean;
  can_submit: boolean;
  can_subscribe: boolean;
  description: string;
  drafts: number;
  facebook: string;
  facebook_opengraph_enabled: string;
  followed: boolean;
  followers: number;
  members: number;
  is_blocked_from_primary: boolean;
  is_nsfw: boolean;
  messages: number;
  name: string;
  posts: number;
  primary: boolean;
  queue: number;
  share_likes: boolean;
  submission_page_title: string;
  submission_terms?: {
    accepted_types?: string[];
    tags?: string[];
    title?: string;
    guidelines?: 'string';
  };
  subscribed: boolean;
  theme: TumblrTheme;
  title: string;
  total_posts: number;
  tweet: string;
  twitter_enabled: boolean;
  twitter_send: boolean;
  type: string;
  updated: number;
  url: string;
  uuid: string;
};

export type TumblrPost = {
  type: string;
  is_blocks_post_format: boolean;
  blog_name: string;
  id: string;
  id_string: string;
  is_blazed: boolean;
  is_blaze_pending: boolean;
  can_ignite: boolean;
  can_blaze: boolean;
  post_url: string;
  slug: string;
  date: string;
  timestamp: number;
  state: string;
  format: string;
  reblog_key: string;
  tags: string[];
  short_url: string;
  summary: string;
  should_open_in_legacy: boolean;
  recommended_source?: string;
  recommended_color?: string;
  followed: boolean;
  liked: boolean;
  note_count: number;
  title?: string;
  body?: string;
  can_like: boolean;
  interactability_reblog: string;
  interactability_blaze: string;
  can_reblog: boolean;
  can_send_in_message: boolean;
  muted: boolean;
  mute_end_timestamp: number;
  can_mute: boolean;
  can_reply: boolean;
  display_avatar: boolean;

  /**
   * Populated on Image and Video posts
   */
  caption?: string;

  description?: string;

  /**
   * Used on some link posts
   */
  excerpt?: string;

  /**
   * Populated when videos or images are shared from a particular page
   */
  source_url?: string;
  source_title?: string;

  publisher?: string;

  /**
   * Populated for Link posts
   */
  url?: string;

  /**
   * Populated for for Video and Image posts
   */
  permalink_url?: string;
  image_permalink?: string;
  video_type?: string;
  video?: {
    [index: string]: {
      video_id: string;
      width: number;
      height: number;
    };
  };

  photos?: TumblrPhoto[];
};

type TumblrPhoto = {
  caption?: string;
  exif?: Record<string, string>;
  original_size: Record<string, string | number>;
};

export type TumblrTheme = {
  avatar_shape: string;
  background_color: string;
  body_font: string;
  header_bounds: string;
  header_image: string;
  header_image_focused: string;
  header_image_poster: string;
  header_image_scaled: string;
  header_stretch: boolean;
  link_color: string;
  show_avatar: boolean;
  show_description: boolean;
  show_header_image: boolean;
  show_title: boolean;
  title_color: string;
  title_font: string;
  title_font_weight: string;
};
