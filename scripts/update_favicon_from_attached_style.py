from PIL import Image
import json
from pathlib import Path

SOURCE_CANDIDATES = [
	Path("/Users/bhavya-mac/Downloads/Favicon - Transparent123.png"),
	Path("public/logo-source.png"),
]


def load_source_image() -> Image.Image:
	for candidate in SOURCE_CANDIDATES:
		if candidate.exists():
			return Image.open(candidate).convert("RGBA")
	raise FileNotFoundError("No favicon source image found in expected locations")


def to_square_canvas(src: Image.Image, size: int = 512) -> Image.Image:
	canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
	src_w, src_h = src.size
	scale = min(size / src_w, size / src_h)
	new_w = max(1, int(round(src_w * scale)))
	new_h = max(1, int(round(src_h * scale)))
	resized = src.resize((new_w, new_h), Image.Resampling.LANCZOS)
	x = (size - new_w) // 2
	y = (size - new_h) // 2
	canvas.paste(resized, (x, y), resized)
	return canvas

img = to_square_canvas(load_source_image(), size=512)

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
