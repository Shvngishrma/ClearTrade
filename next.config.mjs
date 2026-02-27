/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		outputFileTracingIncludes: {
			"/*": ["./node_modules/@sparticuz/chromium/bin/**"],
		},
	},
}

export default nextConfig
