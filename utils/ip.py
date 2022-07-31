from platform import system

def get_local() -> str|None:
    os_name = system()

    match os_name:
        case 'Windows':
            return _get_local_windows() or _get_local_fallback()
        case 'Linux':
            return _get_local_posix() or _get_local_fallback()
        case _:
            return _get_local_fallback()

def _get_local_windows() -> str|None:
    """
    Gets the device local ip on windows systems.
    @see https://stackoverflow.com/a/166520
    """
    from socket import gethostbyname_ex, gethostname

    return gethostbyname_ex(gethostname())[-1][-1]

def _get_local_posix() -> str|None:
    """
    Gets the device local ip on posix systems.
    Uses the `ip` command to get all private "UP" interfaces.
    """
    import subprocess

    ip_out = subprocess.Popen(
        "ip -br a | awk '/UP/ { split($3, ip, \"/\"); print ip[1] }'",
        shell=True,
        stdout=subprocess.PIPE).stdout.read().decode('utf-8')
    ip_list = list(filter(lambda line: len(line.strip()) > 0, ip_out.split('\n')))
    ip_list_len = len(ip_list)

    if ip_list_len <= 0:
        return None
    elif ip_list_len == 1:
        return ip_list[0]

    # if there's multiple results find the first result that is
    # a valid private network
    # https://en.wikipedia.org/wiki/IPv4#Private_networks
    for ip in ip_list:
        dot_list = [int(ip) for ip in ip.split('.')]

        if dot_list[0] == 192 and dot_list[1] == 168:
            return ip
        elif dot_list[0] == 172 and (dot_list[1] >= 16 and dot_list[1] <= 31):
            return ip
        elif dot_list[0] == 10:
            return ip

    return None

def _get_local_fallback() -> str|None:
    """
    Fallback method to get local ip.
    We use a socket to ping a dns server and get the resulting socket name.
    This is a fallback because it requires an internet connection.
    """
    import socket

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(('1.1.1.1', 80))
    ip = s.getsockname()[0]
    s.close()

    return ip
