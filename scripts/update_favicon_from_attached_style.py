from PIL import Image, ImageDraw
import json

S = 512
img = Image.new("RGBA", (S, S), (242, 240, 240, 255))
d = ImageDraw.Draw(img)

# Outer black segmented frame
w = 56
m = 58
seg = 148
# top-left
d.rectangle((m, m, m + seg, m + w), fill=(0, 0, 0, 255))
d.rectangle((m, m, m + w, m + seg), fill=(0, 0, 0, 255))
# top-right
d.rectangle((S - m - seg, m, S - m, m + w), fill=(0, 0, 0, 255))
d.rectangle((S - m - w, m, S - m, m + seg), fill=(0, 0, 0, 255))
# bottom-left
d.rectangle((m, S - m - w, m + seg, S - m), fill=(0, 0, 0, 255))
d.rectangle((m, S - m - seg, m + w, S - m), fill=(0, 0, 0, 255))
# bottom-right
d.rectangle((S - m - seg, S - m - w, S - m, S - m), fill=(0, 0, 0, 255))
d.rectangle((S - m - w, S - m - seg, S - m, S - m), fill=(0, 0, 0, 255))

# Inner light segmented frame
wi = 34
mi = 138
segi = 110
# top-left
d.rectangle((mi, mi, mi + segi, mi + wi), fill=(240, 240, 240, 255))
d.rectangle((mi, mi, mi + wi, mi + segi), fill=(240, 240, 240, 255))
# top-right
d.rectangle((S - mi - segi, mi, S - mi, mi + wi), fill=(240, 240, 240, 255))
d.rectangle((S - mi - wi, mi, S - mi, mi + segi), fill=(240, 240, 240, 255))
# bottom-left
d.rectangle((mi, S - mi - wi, mi + segi, S - mi), fill=(240, 240, 240, 255))
d.rectangle((mi, S - mi - segi, mi + wi, S - mi), fill=(240, 240, 240, 255))
# bottom-right
d.rectangle((S - mi - segi, S - mi - wi, S - mi, S - mi), fill=(240, 240, 240, 255))
d.rectangle((S - mi - wi, S - mi - segi, S - mi, S - mi), fill=(240, 240, 240, 255))

img.save("public/logo-source.png", "PNG", optimize=True)
img.resize((16, 16), Image.Resampling.LANCZOS).save("public/favicon-16x16.png", "PNG", optimize=True)
img.resize((32, 32), Image.Resampling.LANCZOS).save("public/favicon-32x32.png", "PNG", optimize=True)
img.resize((32, 32), Image.Resampling.LANCZOS).save("public/favicon.png", "PNG", optimize=True)
img.resize((180, 180), Image.Resampling.LANCZOS).save("public/apple-touch-icon.png", "PNG", optimize=True)
img.resize((192, 192), Image.Resampling.LANCZOS).save("public/android-chrome-192x192.png", "PNG", optimize=True)
img.resize((512, 512), Image.Resampling.LANCZOS).save("public/android-chrome-512x512.png", "PNG", optimize=True)
img.save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

manifest = {
	"name": "ClearTrade",
	"short_name": "ClearTrade",
	"icons": [
		{
			"src": "/android-chrome-192x192.png",
			"sizes": "192x192",
			"type": "image/png",
		},
		{
			"src": "/android-chrome-512x512.png",
			"sizes": "512x512",
			"type": "image/png",
		},
	],
	"theme_color": "#0f0f0f",
	"background_color": "#f2f0f0",
	"display": "standalone",
}

with open("public/site.webmanifest", "w", encoding="utf-8") as f:
	json.dump(manifest, f, separators=(",", ":"))

print("Updated favicon pack and webmanifest in public/")
