from http.server import HTTPServer, BaseHTTPRequestHandler
from os import path
from urllib.parse import urlparse, parse_qs, unquote
from mimetypes import guess_type
import math

import mouse
import keyboard

from utils import ip

public_root = path.join(path.dirname(path.realpath(__file__)), 'public')
hostname = ip.get_local()
port = 8080

class RequestHandler(BaseHTTPRequestHandler):

    def write_headers(self, code: int = 200, content_type: str = None):
        self.send_response(code)

        if content_type:
            self.send_header('Content-Type', content_type)

        self.end_headers()

    def parse_params(self, *params: tuple|str):
        query = parse_qs(urlparse(self.path).query)
        values = []

        for p in params:
            p_is_tuple = type(p) is tuple
            name = p[0] if p_is_tuple else p
            to = p[1] if p_is_tuple else str
            value = None

            if name in query:
                value = self.parse_value(query[name][0], to)

            values.append(value)

        count = len(values)

        if count <= 0:
            return None
        elif count == 1:
            return values[0]

        return values

    def parse_value(self, value: str, to: type = str):
        try:
            return to(value)
        except ValueError:
            self.write_headers(400)
            print('[ERROR] Invalid param: ' + str(value))
            return None

    #
    #
    #

    def do_GET(self):
        filename = self.path.replace('..', '.')
        filename = path.join(public_root, filename[1:] if filename[0] in '\/' else filename)

        if not path.isfile(filename):
            filename = path.join(filename, 'index.html')

            if not path.isfile(filename):
                self.write_headers(404)
                return

        self.write_headers(content_type=guess_type(filename)[0])

        with open(filename, 'rb') as file:
            self.wfile.write(file.read())

    def do_MOVE(self):
        x, y = self.parse_params(('x', float), ('y', float))

        mouse.move(x, y, absolute=False)
        self.write_headers()

    def do_DOWN(self):
        mouse.press()
        self.write_headers()

    def do_UP(self):
        mouse.release()
        self.write_headers()

    def do_CLICK(self):
        enum = self.parse_params(('b', int))

        if (enum == 0):
            button = mouse.LEFT
        elif (enum == 1):
            button = mouse.MIDDLE
        elif (enum == 2):
            button = mouse.RIGHT
        else:
            self.write_headers(400)
            return

        mouse.click(button)
        self.write_headers()

    def do_DBLCLICK(self):
        mouse.double_click()
        self.write_headers()

    def do_SCROLL(self):
        delta = self.parse_params(('d', float))

        mouse.wheel(math.ceil(delta))
        self.write_headers()

    def do_KEY(self):
        key = self.parse_params(('k', unquote))

        if len(key) > 1:
            keyboard.send(key)
        else:
            keyboard.write(key)

        self.write_headers()

if __name__ == '__main__':
    if not hostname:
        raise ValueError('Could not get local network ip for hosting.')

    httpd = HTTPServer((hostname, port), RequestHandler)
    print(f'Server started at http://{hostname}:{port}')

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

    httpd.server_close()
    print('Server stopped')
