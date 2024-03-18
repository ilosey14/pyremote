from http.server import HTTPServer, BaseHTTPRequestHandler
from os import path
from urllib.parse import urlparse, parse_qs, unquote
from mimetypes import guess_type
import math
import json

from pynput.mouse import Button, Controller as Mouse
from pynput.keyboard import Key, Controller as Keyboard

from utils import ip

public_root = path.join(path.dirname(path.realpath(__file__)), 'public')
hostname = ip.get_local()
port = 8080

class RequestHandler(BaseHTTPRequestHandler):

    __mouse = Mouse()
    __keyboard = Keyboard()

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

    def get_button(self, number: int) -> Button:
        match number:
            case 0:
                return Button.left
            case 1:
                return Button.middle
            case 2:
                return Button.right
            case _:
                return Button.left

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

    def do_PING(self):
        self.write_headers()

    def do_MOVE(self):
        x, y = self.parse_params(('x', float), ('y', float))

        self.__mouse.move(x, y)
        self.write_headers()

    def do_DOWN(self):
        number = self.parse_params(('b', int))
        button = self.get_button(number)

        self.__mouse.press(button)
        self.write_headers()

    def do_UP(self):
        number = self.parse_params(('b', int))
        button = self.get_button(number)

        self.__mouse.release(button)
        self.write_headers()

    def do_CLICK(self):
        number = self.parse_params(('b', int))
        button = self.get_button(number)

        self.__mouse.click(button)
        self.write_headers()

    def do_DBLCLICK(self):
        number = self.parse_params(('b', int))
        button = self.get_button(number)

        self.__mouse.click(button, 2)
        self.write_headers()

    def do_SCROLL(self):
        delta = self.parse_params(('d', float))

        self.__mouse.scroll(0, delta > 0 and math.ceil(delta) or math.floor(delta))
        self.write_headers()

    def do_KEY(self):
        key = self.parse_params(('k', unquote))
        length = len(key);

        try:
            if length > 1:
                # parse combination
                if '+' in key:
                    keys = key.split('+')
                    mods = [k.lower() for k in keys[:-1]]
                    key = keys[-1]

                    # verify modifiers
                    for k in mods:
                        if not k in Key.__members__:
                            key = '+'.join((*mods, key))
                            raise

                    # press keys in order
                    for k in mods:
                        self.__keyboard.press(Key[k])

                    self.__keyboard.tap(key)
                    mods.reverse()

                    for k in mods:
                        self.__keyboard.release(Key[k])

                # must be a single, named key
                else:
                    key = key.lower()

                    if (key in Key.__members__):
                        self.__keyboard.tap(Key[key])
                    else:
                        raise
            elif length == 1:
                self.__keyboard.tap(key)
        except:
            print(f'Unsupported key "{key}".')

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
