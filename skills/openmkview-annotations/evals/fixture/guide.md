# Guide

Annotations are stored beside the document, never inside it.

## Reading

Call the list endpoint with a project id and a relative path to read
the annotations for one file. Omit the path to read the whole project.

## Writing

Create an annotation from a file path and a quoted span.
The client computes the Anchor from the rendered block, so the quote
must match the text the reader sees rather than the raw Markdown.

## Resolving

Mark a thread resolved when its feedback has been handled.
Resolved threads stay in the file and can still be filtered.
