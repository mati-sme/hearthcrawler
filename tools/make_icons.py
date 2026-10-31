#!/usr/bin/env python3
"""Draws the Hearthcrawler app icon (a caravan on a sunny circle) with only the stdlib.
Usage: python3 tools/make_icons.py   -> writes icons/icon-192.png and icons/icon-512.png
"""
import os, struct, zlib

SS = 2  # supersampling per axis


class Canvas:
    def __init__(self, n):
        self.n = n
        self.px = [[(0, 0, 0, 0)] * n for _ in range(n)]

    def blend(self, x, y, col, a):
        r, g, b, pa = self.px[y][x]
        self.px[y][x] = (col[0] * a + r * (1 - a), col[1] * a + g * (1 - a), col[2] * a + b * (1 - a), a + pa * (1 - a))

    def fill(self, inside, bbox, col, grad=None):
        x0, y0, x1, y1 = [max(0, int(v)) for v in bbox]
        x1 = min(self.n - 1, x1)
        y1 = min(self.n - 1, y1)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                hit = 0
                for sy in range(SS):
                    for sx in range(SS):
                        if inside(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS):
                            hit += 1
                if hit:
                    self.blend(x, y, grad(x, y) if grad else col, hit / (SS * SS))

    def circle(self, cx, cy, r, col, grad=None):
        self.fill(lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r, (cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1), col, grad)

    def ellipse(self, cx, cy, rx, ry, col):
        self.fill(lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, (cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1), col)

    def rrect(self, x, y, w, h, r, col, grad=None):
        def inside(px, py):
            qx = max(abs(px - (x + w / 2)) - (w / 2 - r), 0)
            qy = max(abs(py - (y + h / 2)) - (h / 2 - r), 0)
            return qx * qx + qy * qy <= r * r
        self.fill(inside, (x - 1, y - 1, x + w + 1, y + h + 1), col, grad)

    def png(self):
        raw = bytearray()
        for row in self.px:
            raw.append(0)
            for r, g, b, a in row:
                raw += bytes((int(r), int(g), int(b), int(a * 255)))

        def chunk(t, d):
            c = struct.pack('>I', len(d)) + t + d
            return c + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
        return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', self.n, self.n, 8, 6, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))


def draw(n):
    c = Canvas(n)
    k = n / 512.0

    def S(v):
        return v * k

    # full-bleed warm gradient (safe for maskable icons)
    c.rrect(0, 0, n, n, 0, None, lambda x, y: (255 - 40 * y / n, 170 - 60 * y / n, 70 - 30 * y / n))
    # sun circle
    c.circle(S(256), S(256), S(228), (255, 233, 160), lambda x, y: (255, 245 - 40 * y / n, 200 - 80 * y / n))
    # ground shadow
    c.ellipse(S(262), S(430), S(150), S(26), (200, 140, 80))
    # ox (top-down, in front)
    c.rrect(S(150), S(60), S(18), S(40), S(9), (243, 230, 196))
    c.rrect(S(344), S(60), S(18), S(40), S(9), (243, 230, 196))
    c.rrect(S(166), S(84), S(26), S(12), S(6), (243, 230, 196))
    c.rrect(S(320), S(84), S(26), S(12), S(6), (243, 230, 196))
    c.ellipse(S(256), S(122), S(52), S(46), (201, 138, 72))
    c.ellipse(S(256), S(148), S(34), S(22), (232, 184, 120))
    c.circle(S(236), S(128), S(8), (60, 40, 20))
    c.circle(S(276), S(128), S(8), (60, 40, 20))
    c.circle(S(236), S(124), S(5), (110, 224, 255))
    c.circle(S(276), S(124), S(5), (110, 224, 255))
    # hitch
    c.rrect(S(246), S(165), S(20), S(60), S(8), (90, 74, 58))
    # wheels
    for wx in (118, 372):
        for wy in (260, 350):
            c.rrect(S(wx), S(wy), S(24), S(68), S(12), (58, 46, 40))
    # body
    c.rrect(S(138), S(210), S(236), S(210), S(34), (169, 112, 58))
    c.rrect(S(146), S(216), S(220), S(196), S(28), (201, 143, 78))
    c.rrect(S(146), S(216), S(220), S(14), S(7), (243, 217, 160))
    # module tiles
    cols = [(126, 160, 190), (232, 120, 58), (90, 190, 100), (255, 210, 80)]
    pos = [(168, 246), (268, 246), (168, 332), (268, 332)]
    for col, (mx, my) in zip(cols, pos):
        c.rrect(S(mx), S(my), S(80), S(74), S(14), (255, 246, 225))
        c.rrect(S(mx + 8), S(my + 8), S(64), S(58), S(10), col)
    c.circle(S(308), S(284), S(14), (255, 220, 100))
    # flag
    c.rrect(S(352), S(150), S(7), S(90), S(3), (90, 74, 58))
    c.fill(lambda x, y: x >= S(358) and S(152) <= y <= S(196) and (x - S(358)) <= S(60) * (1 - abs(y - S(174)) / S(22)),
           (S(358), S(150), S(420), S(200)), (239, 91, 91))
    return c


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons')
    os.makedirs(out, exist_ok=True)
    for size in (192, 512):
        with open(os.path.join(out, 'icon-%d.png' % size), 'wb') as f:
            f.write(draw(size).png())
        print('wrote icon-%d.png' % size)
