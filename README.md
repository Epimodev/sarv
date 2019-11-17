# Sarv: another static file server with brotli support

### Presentation

Sarv is a new static file server which was developped to serve SPA (single page applications) with compressed files (brotli or gzip).
There isn't compression during the request so files should be compressed before server start.

> for performance improvements, sarv check files on start (technique inspired by [sirv](https://github.com/lukeed/sirv)), this can lead to those errors:
> - if a file is deleted, request will send a 500 error instead of a 404
> - if a file is created, request will send a 404 error instead of a 200 with file

### Motivation

The main goal of this project is creating a static file server able to serve brotli compressed files.
According to this article of [web.dev](https://web.dev/codelab-text-compression-brotli/) we can easly add brotli support on express static server.
Then I discover [sirv](https://github.com/lukeed/sirv) which seems to be a faster alternative (because it doesn't check file existance on every request). So I tried to use the same technique explained in web.dev article by using [polka](https://github.com/lukeed/polka) and [sirv](https://github.com/lukeed/sirv), but I've got some issues:
- content-type is set by `sirv` depending on file name. So by replacing path `app.js` by `app.js.br`, content-type become `text/html` instead of `application/javascript`. Even if we can set `content-type` header in a middleware or in `setHeaders` option, `content-type` is overwrite just before sending requested file.
- `sirv` has an option to send etag header for browser cache but it doesn’t check `if-none-match` request header to send a 304 response without the file.

So I create `sarv`, another static file server to workaround those issues. It's based on [polka](https://github.com/lukeed/polka) and most of the code is inspired by [sirv](https://github.com/lukeed/sirv) but there are some differences:
- send pre-compressed brolti or gzip files (depending on `accept-encoding` header)
- force by default the browser to check if file hasn't change before getting it from cache (by using `cache-control` and `etag` headers)
- send 304 response without file if the browser has already load the file
- add some info in log (`content-encoding` and `content-length`)

### Instalation
```bash
# install locally in your project
yarn add @epimodev/sarv
# install globally
yarn global add @epimodev/sarv

# or with npm
npm install @epimodev/sarv
# install globally
npm install --global @epimodev/sarv
```

### Usage
```bash
# start a server for `public` folder
sarv public

# start a server binded to 8080 port
sarv public --port 8080

# start a server which fallback not found to index.html (for single page application)
sarv public --fallback /index.html

# display all options
sarv --help
```

### Options
```bash
Description
  Run a static file server

Usage
  $ sarv [dir] [options]

Options
  -h, --host        Hostname to bind  (default localhost)
  -p, --port        Port to bind  (default 3000)
  -i, --index       Define index file name  (default index.html)
  -f, --fallback    Define fallback file
  -m, --maxage      Define max-age value (in sec) in "Cache-Control" header  (default 1209600)
  -v, --verbose     Display content encoding and content length in logs
  -v, --version     Displays current version
  -h, --help        Displays this message

Examples
  $ sarv public
  $ sarv public --port 8080
  $ sarv public --fallback /index.html
```
