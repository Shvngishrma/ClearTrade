/** @type {import('next').NextConfig} */
const nextConfig = {
	serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
	experimental: {
		outputFileTracingIncludes: {
			"/*": [
				"node_modules/@sparticuz/chromium/bin/**",
				"node_modules/@sparticuz/chromium/build/**",
			],
		},
	},
}

export default nextConfig
