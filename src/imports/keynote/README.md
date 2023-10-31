# Keynote Import

This one is a little idiosyncratic; it's designed to take a pile of random Keynote
"stuff" and export it as a unified JSON file alongside per-slide image files.

## Import modes

The importer will look in the import directory for several different file formats, depending
on the import mode in its constructor options:

- PDF: A PDF exported from Keynote in 'with presenter notes' format. The primary
  image on each slide will be exported as the Slide Image, and the text will be exported
  as the slide transcript. Pages with no image will be treated as a continuation of the
  previous slide's text.
- Folder: A folder full of images will be treated as the slide images. If there's a file
  named transcript.txt or transcript.md present, it will be read in and used as the
  transcript text. The text for individual slides should be separated with by a triple-dash
  on its own line (`\n---\n`).
- JSON: A single JSON file containing an array of slide objects in the following format:
  `{ image: 'path/to/image-01.jpg', transcript: 'Optional notes or transcript…' }`
