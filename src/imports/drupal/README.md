# Drupal Importers

Drupal is a weird beast; posts and other content are splattered across sometimes dozens of tables,
depending on the complexity of the site's content model. We're going to brute force it by:

1. Grabbing every user, term, node, and node revision
2. Grabbing every field and field revision based on table naming conventions
3. Dropping old node revisions
4. Marging in field data
5. Calling it a day
6. Grabbing file/upload/managed-file records and... handling them. Somehow.

Site by site, there are probably also a lot of other tables that contain important information; specifying them as import parameters and blindly caching them probably makes sense. If they contain a node- user- or term- joinable column, specifying it will glomp the data onto the base entity.

I say that like it's simple, but it's essentially the CRUD layer for CCK. Yay.