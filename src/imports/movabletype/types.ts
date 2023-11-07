import is from '@sindresorhus/is';

// Post-tidying

export type MTData = {
  blogs: Record<number, MTBlog>;
  authors: Record<number, MTAuthor>;
  categories: Record<number, MTCategory>;
  entries: Record<number, MTEntry>;
  comments: Record<number, MTComment>;
};

export type MTBlog = {
  id: number;
  name: string;
  url: string;
  message?: string;
};

export type MTCategory = {
  id: number;
  blog: number;
  name: string;
  description?: string;
  parent?: number;
};

export type MTAuthor = {
  id: number;
  type: number;
  name: string;
  nickname?: string;
  email: string;
};

export type MTEntry = {
  id: number;
  blog: number;
  status: number;
  date: string;
  title: string;
  author: number;
  category?: number;
  body: string;
  extended?: string;
  keywords?: Record<string, string>;
};

export type MTComment = {
  id: number;
  blog: number;
  entry: number;
  ip: string;
  date: string;
  name?: string;
  email?: string;
  url?: string;
  body: string;
};

export type MovableTypeTables = {
  blogs: MovableTypeBlogRow[];
  authors: MovableTypeAuthorRow[];
  categories: MovableTypeCategoryRow[];
  entries: MovableTypeEntryRow[];
  comments: MovableTypeCommentRow[];
  [index: string]: Record<string, unknown>[];
};

export type MovableTypeRow =
  | MovableTypeBlogRow
  | MovableTypeAuthorRow
  | MovableTypeEntryRow
  | MovableTypeCategoryRow
  | MovableTypeCommentRow;

export type MovableTypeAuthorRow = {
  author_id: number;
  author_name: string;
  author_type: number;
  author_nickname: string;
  author_password: string;
  author_email: string;
  author_url: string;
  author_can_create_blog: number;
  author_can_view_log: number;
  author_hint: string;
  author_created_by?: string;
  author_public_key?: string;
  author_preferred_language: string;
  author_remote_auth_username: string;
  author_remote_auth_token: string;

  blogs?: Record<number, MovableTypeBlogRow>;
  blogIds?: number[];
  entries?: Record<number, MovableTypeEntryRow>;
  entryIds?: number[];
  comments?: Record<number, MovableTypeCommentRow>;
  commentIds?: number[];
};

export type MovableTypeBlogRow = {
  blog_id: number;
  blog_name: string;
  blog_description: string;
  blog_site_path: string;
  blog_site_url: string;
  blog_archive_path: string;
  blog_archive_url: string;
  blog_archive_type: string;
  blog_archive_type_preferred: string;
  blog_days_on_index: number;
  blog_language: string;
  blog_file_extension: string;
  blog_email_new_comments: number;
  blog_email_new_pings: number;
  blog_allow_comment_html: number;
  blog_autolink_urls: number;
  blog_sort_order_posts: string;
  blog_sort_order_comments: string;
  blog_allow_comments_default: number;
  blog_allow_pings_default: number;
  blog_server_offset: number;
  blog_convert_paras: string;
  blog_convert_paras_comments: string;
  blog_status_default: number;
  blog_allow_anon_comments: number;
  blog_allow_reg_comments: number;
  blog_allow_unreg_comments: number;
  blog_moderate_unreg_comments: number;
  blog_require_comment_emails: number;
  blog_manual_approve_commenters: number;
  blog_words_in_excerpt: number;
  blog_ping_technorati: number;
  blog_ping_weblogs: number;
  blog_ping_blogs: number;
  blog_ping_others: string;
  blog_mt_update_key: string;
  blog_autodiscover_links: number;
  blog_welcome_msg: string;
  blog_old_style_archive_links: number;
  blog_archive_tmpl_monthly: string;
  blog_archive_tmpl_weekly: string;
  blog_archive_tmpl_daily: string;
  blog_archive_tmpl_individual: string;
  blog_archive_tmpl_category: string;
  blog_google_api_key: string;
  blog_sanitize_spec: string;
  blog_cc_license: string;
  blog_is_dynamic: number;
  blog_remote_auth_token: string;
  blog_children_modified_on: string;
  blog_custom_dynamic_templates: string;

  authors?: Record<number, MovableTypeAuthorRow>;
  authorIds?: number[];
  categories?: Record<number, MovableTypeCategoryRow>;
  categoryIds?: number[];
  entries?: Record<number, MovableTypeEntryRow>;
  entryIds?: number[];
  comments?: Record<number, MovableTypeCommentRow>;
  commentIds?: number[];
};

export type MovableTypeEntryRow = {
  entry_id: number;
  entry_blog_id: number;
  entry_status: number;
  entry_author_id: number;
  entry_allow_comments: number;
  entry_allow_pings: number;
  entry_convert_breaks: string;
  entry_category_id: number;
  entry_title: string;
  entry_excerpt: string;
  entry_text: string;
  entry_text_more: string;
  entry_to_ping_urls: string;
  entry_pinged_urls: string;
  entry_keywords: string;
  entry_tangent_cache: string;
  entry_created_on: string;
  entry_modified_on: string;
  entry_created_by: string;
  entry_modified_by: string;
  entry_basename: string;

  author?: MovableTypeAuthorRow;
  categories?: Record<number, MovableTypeCategoryRow>;
  categoryIds?: number[];
  comments?: Record<number, MovableTypeCommentRow>;
  commentIds?: number[];
};

export type MovableTypeCategoryRow = {
  category_id: number;
  category_blog_id: number;
  category_allow_pings: number;
  category_label: string;
  category_description: string;
  category_author_id: number;
  category_ping_urls: string;
  category_parent: number;

  author?: MovableTypeAuthorRow;
  entries?: Record<number, MovableTypeEntryRow>;
  entryIds?: number[];
};

export type MovableTypeCommentRow = {
  comment_id: number;
  comment_blog_id: number;
  comment_entry_id: number;
  comment_ip: string;
  comment_author: string;
  comment_email: string;
  comment_url: string;
  comment_commenter_id: string;
  comment_visible: number;
  comment_text: string;
  comment_created_on: string;
  comment_modified_on: string;
  comment_created_by: string;
  comment_modified_by: string;

  entry?: MovableTypeEntryRow;
  blog?: MovableTypeBlogRow;
};

export function isBlog(input: unknown): input is MovableTypeBlogRow {
  return is.plainObject(input) && 'blog_id' in input;
}

export function isCategory(input: unknown): input is MovableTypeCategoryRow {
  return is.plainObject(input) && 'category_id' in input;
}

export function isAuthor(input: unknown): input is MovableTypeAuthorRow {
  return is.plainObject(input) && 'author_id' in input;
}

export function isEntry(input: unknown): input is MovableTypeEntryRow {
  return is.plainObject(input) && 'entry_id' in input;
}

export function isComment(input: unknown): input is MovableTypeCommentRow {
  return is.plainObject(input) && 'comment_id' in input;
}
