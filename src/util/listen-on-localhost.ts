import http from 'http';
import open from 'open';

type Options = {
  /**
   * The port to listen on.
   *
   * @defaultValue 9000
   */
  port?: number,

  /**
   * Launch a browser window and open a URL; if set to TRUE, `http://localhost:port` is used.
   * 
   * @defaultValue `false`
   */
  launchBrowser?: boolean | string,

  /**
   * A callback function that can write to the response, and optionally tell
   * the server to keep listening for additional requests.
   * 
   * Returning TRUE will keep the server running; returning FALSE or returning
   * no value will cause it to close, resolving the promise.
   */
  listen?: (req: http.IncomingMessage, body: string | null, res: http.ServerResponse<http.IncomingMessage>) => boolean | void,
}

type Result = {
  request: http.IncomingMessage,
  body: string | null
}

/**
 * Launches an HTTP server and listens for an incoming connection; returns a
 * promise that resolves to the request and request body.
 */
export async function listenOnLocalhost(options: Options = {}): Promise<Result> {
  const port = options.port ??= 9000;
  let keepListening = false;
  let body: string | null = null;

  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on('request', (request, response) => {
      let chunks: Uint8Array[] = [];
      request.on('data', (chunk) => chunks.push(chunk));
      request.on('end', () => {
        if (chunks.length) body = Buffer.concat(chunks).toString();
        if (options.listen) {
          keepListening = options.listen(request, body, response) ?? false;
        }
        request.destroy();
        response.end();
      });

      if (!keepListening) {
        server.close(() => resolve({ request, body }));
      }
    });

    server.on('listening', () => {
      if (typeof(options.launchBrowser) === 'string') {
        open(options.launchBrowser);
      } else if (options.launchBrowser === true) {
        open(`http://localhost:${port}`);
      }
    });

    server.on('error', reject);

    server.listen(options.port);
  });
}
